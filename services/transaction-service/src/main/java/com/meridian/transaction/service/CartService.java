package com.meridian.transaction.service;

import com.meridian.transaction.domain.Cart;
import com.meridian.transaction.domain.CartItem;
import com.meridian.transaction.dto.AddCartItemDto;
import com.meridian.transaction.dto.CartResponse;
import com.meridian.transaction.messaging.TransactionEventPublisher;
import com.meridian.transaction.repository.CartItemRepository;
import com.meridian.transaction.repository.CartRepository;
import com.meridian.transaction.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CartService {

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final BusinessEventLogger businessEventLogger;
    private final TransactionEventPublisher transactionEventPublisher;

    @Transactional
    public CartResponse addItem(AddCartItemDto dto) {
        if (dto.getIdentityId() == null || dto.getIdentityId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "identity_id is required");
        }
        if (dto.getProductId() == null || dto.getProductId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "product_id is required");
        }
        if (dto.getQuantity() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "quantity must be > 0");
        }

        // Find or create an open cart for this identity.
        Cart cart = cartRepository.findFirstByIdentityIdAndStatusOrderByCreatedAtDesc(dto.getIdentityId(), "open")
                .orElseGet(() -> cartRepository.save(Cart.create(dto.getIdentityId())));

        CartItem item = CartItem.create(cart.getId(), dto.getProductId(), dto.getProductName(),
                dto.getQuantity(), dto.getUnitPriceCents());
        cartItemRepository.save(item);

        log.info("Added item to cart cart={} identity={} product={} qty={}",
                cart.getId(), dto.getIdentityId(), dto.getProductId(), dto.getQuantity());
        businessEventLogger.cartItemAdded(cart.getId(), dto.getIdentityId(), dto.getProductId(), dto.getQuantity());
        transactionEventPublisher.publishCartItemAdded(cart.getId(), dto.getIdentityId(),
                dto.getProductId(), dto.getQuantity());

        return toCartResponse(cart);
    }

    @Transactional(readOnly = true)
    public CartResponse getCart(String identityId) {
        if (identityId == null || identityId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "identity_id is required");
        }
        Cart cart = cartRepository.findFirstByIdentityIdAndStatusOrderByCreatedAtDesc(identityId, "open")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "cart not found"));
        return toCartResponse(cart);
    }

    @Transactional(readOnly = true)
    public List<CartResponse> listCarts(String identityId) {
        if (identityId == null || identityId.isBlank()) {
            return List.of();
        }
        return cartRepository.findByIdentityIdOrderByCreatedAtDesc(identityId).stream()
                .map(this::toCartResponse)
                .toList();
    }

    @Transactional
    public void clearCart(String identityId) {
        if (identityId == null || identityId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "identity_id is required");
        }
        Cart cart = cartRepository.findFirstByIdentityIdAndStatusOrderByCreatedAtDesc(identityId, "open")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "cart not found"));
        cartItemRepository.deleteByCartId(cart.getId());
        cart.setUpdatedAt(OffsetDateTime.now());
        cartRepository.save(cart);
        log.info("Cleared cart cart={} identity={}", cart.getId(), identityId);
    }

    private CartResponse toCartResponse(Cart cart) {
        List<CartResponse.Item> items = cartItemRepository.findByCartId(cart.getId()).stream()
                .map(it -> CartResponse.Item.builder()
                        .productId(it.getProductId())
                        .productName(it.getProductName())
                        .quantity(it.getQuantity())
                        .unitPriceCents(it.getUnitPriceCents())
                        .build())
                .toList();
        return CartResponse.builder()
                .id(cart.getId())
                .identityId(cart.getIdentityId())
                .status(cart.getStatus())
                .items(items)
                .createdAt(cart.getCreatedAt())
                .updatedAt(cart.getUpdatedAt())
                .build();
    }
}
