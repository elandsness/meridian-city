package com.meridian.journey.repository;

import com.meridian.journey.domain.Journey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JourneyRepository extends JpaRepository<Journey, String> {

    Optional<Journey> findByEntityTypeAndRelatedId(String entityType, String relatedId);

    Optional<Journey> findByEntityTypeAndUserId(String entityType, String userId);

    List<Journey> findByEntityTypeOrderByCreatedAtDesc(String entityType);

    List<Journey> findByEntityTypeAndStatus(String entityType, String status);

    List<Journey> findByEntityTypeAndDirection(String entityType, String direction);

    List<Journey> findByStatusOrderByCreatedAtDesc(String status);

    List<Journey> findAllByOrderByCreatedAtDesc();
}