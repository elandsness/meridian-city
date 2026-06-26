package com.meridian.commerce.service;

import com.meridian.commerce.config.FaultInjectionConfig;
import com.meridian.commerce.config.FulfillmentProperties;
import com.meridian.commerce.domain.Cart;
import com.meridian.commerce.domain.CartItem;
import com.meridian.commerce.domain.Order;
import com.meridian.commerce.domain.OrderItem;
import com.meridian.commerce.domain.Product;
import com.meridian.commerce.dto.OrderResponse;
import com.meridian.commerce.messaging.OrderEventPublisher;
import com.meridian.commerce.repository.CartItemRepository;
import com.meridian.commerce.repository.CartRepository;
import com.meridian.commerce.repository.OrderItemRepository;
import com.meridian.commerce.repository.OrderRepository;
import com.meridian.commerce.repository.ProductRepository;
import com.meridian.commerce.util.BusinessEventLogger;
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
    private final OrderEventPublisher orderEventPublisher;
    private final FaultInjectionConfig faultConfig;
    private final FulfillmentProperties fulfillment;

    @Transactional
    public OrderResponse checkout(String citizenId) {
        if (citizenId == null || citizenId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "citizen_id is required");
        }
        Cart cart = cartRepository.findFirstByCitizenIdAndStatusOrderByCreatedAtDesc(citizenId, "open")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "cart is empty"));
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        if (items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cart is empty");
        }

        applyDbSlowdown();

        int total = items.stream().mapToInt(it -> it.getUnitPriceCents() * it.getQuantity()).sum();
        int count = items.stream().mapToInt(CartItem::getQuantity).sum();

        Order order = Order.create(citizenId, cart.getId(), total, count);
        order.setNextTransitionAt(OffsetDateTime.now().plusSeconds(fulfillment.getPackedAfterSeconds()));
        order = orderRepository.save(order);

        Set<String> productIds = items.stream().map(CartItem::getProductId).collect(Collectors.toSet());
        Map<String, String> names = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Product::getName));
        for (CartItem it : items) {
            orderItemRepository.save(OrderItem.builder()
                    .orderId(order.getId())
                    .productId(it.getProductId())
                    .productName(names.getOrDefault(it.getProductId(), it.getProductId()))
                    .quantity(it.getQuantity())
                    .unitPriceCents(it.getUnitPriceCents())
                    .build());
        }

        // Close the cart and clear its items; the next add-to-cart opens a fresh one.
        cart.setStatus("checked_out");
        cart.setUpdatedAt(OffsetDateTime.now());
        cartRepository.save(cart);
        cartItemRepository.deleteByCartId(cart.getId());

        log.info("Checkout complete order={} citizen={} total_cents={}", order.getId(), citizenId, total);
        businessEventLogger.checkoutCompleted(order.getId(), order.getCartId(), citizenId, total, count);
        orderEventPublisher.publishOrderEvent("checkout.completed", order);

        return toOrderResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listOrders(String citizenId) {
        if (citizenId == null || citizenId.isBlank()) {
            return List.of();
        }
        return orderRepository.findByCitizenIdOrderByCreatedAtDesc(citizenId).stream()
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
        FaultInjectionConfig.DbSlowdown s = faultConfig.getDbSlowdown();
        if (s.isEnabled() && s.getDelayMs() > 0) {
            try {
                Thread.sleep(s.getDelayMs());
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
                .citizenId(order.getCitizenId())
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
