package com.meridian.commerce.repository;

import com.meridian.commerce.domain.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, String> {

    List<Order> findByCitizenIdOrderByCreatedAtDesc(String citizenId);

    // Orders due for their next lifecycle transition (used by FulfillmentScheduler).
    List<Order> findByStatusNotAndNextTransitionAtLessThanEqual(String status, OffsetDateTime ts);
}
