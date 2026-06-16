package com.meridian.commerce.repository;

import com.meridian.commerce.domain.Cart;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CartRepository extends JpaRepository<Cart, String> {

    Optional<Cart> findFirstByCitizenIdAndStatusOrderByCreatedAtDesc(String citizenId, String status);
}
