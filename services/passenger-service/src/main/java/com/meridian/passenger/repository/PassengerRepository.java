package com.meridian.passenger.repository;

import com.meridian.passenger.domain.Passenger;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PassengerRepository extends JpaRepository<Passenger, String> {

    List<Passenger> findByStatusInAndNextTransitionAtLessThanEqual(List<String> statuses, OffsetDateTime cutoff);

    List<Passenger> findAllByOrderByCreatedAtDesc();

    List<Passenger> findByStatus(String status);

    long countByStatusNotIn(List<String> statuses);

    Optional<Passenger> findFirstByOwnerIdOrderByCreatedAtDesc(String ownerId);
}
