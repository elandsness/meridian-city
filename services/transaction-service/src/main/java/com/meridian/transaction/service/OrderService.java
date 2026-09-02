package com.meridian.transaction.service;

import com.meridian.transaction.config.FaultState;
import com.meridian.transaction.config.FulfillmentProperties;
import com.meridian.transaction.domain.Cart;
import com.meridian.transaction.domain.CartItem;
import com.meridian.transaction.domain.Order;
import com.meridian.transaction.domain.OrderItem;
import com.meridian.transaction.domain.Product;
import com.meridian.transaction.dto.OrderResponse;
import com.meridian.transaction.messaging.TransactionEventPublisher;
import com.meridian.transaction.repository.CartItemRepository;
import com.meridian.transaction.repository.CartRepository;
import com.meridian.transaction.repository.OrderItemRepository;
import com.meridian.transaction.repository.OrderRepository;
import com.meridian.transaction.repository.ProductRepository;
import com.meridian.transaction.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ProductRepository productRepository;
    private final BusinessEventLogger businessEventLogger;
    private final TransactionEventPublisher transactionEventPublisher;
    private final FaultState faultState;
    private final FulfillmentProperties fulfillment;

    @Transactional
    public OrderResponse checkout(String identityId) {
        if (identityId == null || identityId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "identity_id is required");
        }
        Cart cart = cartRepository.findFirstByIdentityIdAndStatusOrderByCreatedAtDesc(identityId, "open")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "cart is empty"));
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        if (items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cart is empty");
        }

        applyDbSlowdown();

        int total = items.stream().mapToInt(it -> it.getUnitPriceCents() * it.getQuantity()).sum();
        int count = items.stream().mapToInt(CartItem::getQuantity).sum();

        // Business-exception (gated, default off): fail a share of payments at the gateway.
        // Emits transaction.payment_failed on the same cart.id and rejects with 402 — no order,
        // cart left open for retry — so the purchase flow shows an error branch + conversion
        // drop-off at the Checkout step.
        if (faultState.isPaymentFailEnabled()
                && ThreadLocalRandom.current().nextDouble() < faultState.getPaymentFailRate()) {
            businessEventLogger.checkoutPaymentFailed(cart.getId(), identityId, total, count);
            log.warn("Checkout payment failed (fault) cart={} identity={}", cart.getId(), identityId);
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "payment failed");
        }

        Order order = Order.create(identityId, cart.getId(), total, count);
        order.setNextTransitionAt(OffsetDateTime.now().plusSeconds(fulfillment.nextPackedDelaySeconds()));
        order = orderRepository.save(order);

        Set<String> productIds = items.stream().map(CartItem::getProductId).collect(Collectors.toSet());
        Map<String, String> names = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Product::getName));
        for (CartItem it : items) {
            orderItemRepository.save(OrderItem.create(order.getId(), it.getProductId(),
                    names.getOrDefault(it.getProductId(), it.getProductId()),
                    it.getQuantity(), it.getUnitPriceCents()));
        }

        // Close the cart and clear its items; the next add-to-cart opens a fresh one.
        cart.setStatus("checked_out");
        cart.setUpdatedAt(OffsetDateTime.now());
        cartRepository.save(cart);
        cartItemRepository.deleteByCartId(cart.getId());

        log.info("Checkout complete order={} identity={} total_cents={}", order.getId(), identityId, total);
        businessEventLogger.checkoutCompleted(order.getId(), order.getCartId(), identityId, total, count);
        transactionEventPublisher.publishOrderEvent("checkout.completed", order);

        return toOrderResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listOrders(String identityId) {
        if (identityId == null || identityId.isBlank()) {
            return List.of();
        }
        return orderRepository.findByIdentityIdOrderByCreatedAtDesc(identityId).stream()
                .map(this::toOrderResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrder(String id) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "order not found: " + id));
        return toOrderResponse(order);
    }

    private void applyDbSlowdown() {
        if (faultState.isDbSlowdownEnabled() && faultState.getDbSlowdownDelayMs() > 0) {
            try {
                Thread.sleep(faultState.getDbSlowdownDelayMs());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private OrderResponse toOrderResponse(Order order) {
        List<OrderResponse.Line> lines = orderItemRepository.findByOrderId(order.getId()).stream()
                .map(it -> OrderResponse.Line.builder()
                        .productId(it.getProductId())
                        .productName(it.getProductName())
                        .quantity(it.getQuantity())
                        .unitPriceCents(it.getUnitPriceCents())
                        .build())
                .toList();
        return OrderResponse.builder()
                .id(order.getId())
                .identityId(order.getIdentityId())
                .status(order.getStatus())
                .totalCents(order.getTotalCents())
                .itemCount(order.getItemCount())
                .items(lines)
                .placedAt(order.getPlacedAt())
                .packedAt(order.getPackedAt())
                .shippedAt(order.getShippedAt())
                .deliveredAt(order.getDeliveredAt())
                .createdAt(order.getCreatedAt())
                .build();
    }
}
