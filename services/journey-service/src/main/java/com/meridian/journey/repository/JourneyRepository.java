package com.meridian.journey.repository;

import com.meridian.journey.domain.Journey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;

@Repository
public interface JourneyRepository extends JpaRepository<Journey, String> {

    List<Journey> findByEntityTypeOrderByCreatedAtDesc(String entityType);

    List<Journey> findByStatusInAndNextTransitionAtLessThanEqual(
            List<String> statuses, OffsetDateTime now);

    @Query("SELECT j FROM Journey j WHERE j.entityType = :entityType AND j.status = :status")
    List<Journey> findByEntityTypeAndStatus(@Param("entityType") String entityType,
                                            @Param("status") String status);

    @Query("SELECT j FROM Journey j WHERE j.entityType = :entityType AND j.direction = :direction")
    List<Journey> findByEntityTypeAndDirection(@Param("entityType") String entityType,
                                               @Param("direction") String direction);
}
