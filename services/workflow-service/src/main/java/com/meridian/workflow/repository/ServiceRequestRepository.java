package com.meridian.workflow.repository;

import com.meridian.workflow.domain.ServiceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, String> {

    Optional<ServiceRequest> findByRequestId(String requestId);

    List<ServiceRequest> findByStatus(String status);

    List<ServiceRequest> findByStatusInAndNextTransitionAtLessThanEqual(
            Collection<String> statuses, OffsetDateTime cutoff);
}
