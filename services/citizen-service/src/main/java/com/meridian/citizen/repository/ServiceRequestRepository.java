package com.meridian.citizen.repository;

import com.meridian.citizen.domain.ServiceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, String> {

    List<ServiceRequest> findByCitizenIdOrderByCreatedAtDesc(String citizenId);

    List<ServiceRequest> findByStatusInAndNextTransitionAtLessThanEqual(
            Collection<String> statuses, OffsetDateTime cutoff);
}
