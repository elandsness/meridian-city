package com.meridian.transaction.repository;

import com.meridian.transaction.domain.Cart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CartRepository extends JpaRepository<Cart, String> {

    Optional<Cart> findFirstByIdentityIdAndStatusOrderByCreatedAtDesc(String identityId, String status);

    List<Cart> findByIdentityIdOrderByCreatedAtDesc(String identityId);

    void deleteByCartId(String cartId);
}
