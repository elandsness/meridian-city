package com.meridian.workflow.repository;

import com.meridian.workflow.domain.ServiceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, String> {

    List<ServiceRequest> findByStatus(String status);

    List<ServiceRequest> findByStatusInAndNextTransitionAtLessThanEqual(
            Collection<String> statuses, OffsetDateTime cutoff);
}
