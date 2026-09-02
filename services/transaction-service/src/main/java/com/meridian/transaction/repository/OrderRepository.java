package com.meridian.transaction.repository;

import com.meridian.transaction.domain.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, String> {

    List<Order> findByIdentityIdOrderByCreatedAtDesc(String identityId);

    @Query("SELECT o FROM Order o WHERE o.status <> 'delivered' AND o.nextTransitionAt <= :now ORDER BY o.nextTransitionAt")
    List<Order> findByStatusNotAndNextTransitionAtLessThanEqual(@Param("now") OffsetDateTime now);

    @Query("SELECT DISTINCT o.identityId FROM Order o")
    List<String> findDistinctIdentityIds();
}
