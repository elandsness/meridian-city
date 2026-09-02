package com.meridian.workflow.repository;

import com.meridian.workflow.domain.WorkOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface WorkOrderRepository extends JpaRepository<WorkOrder, String> {

    Optional<WorkOrder> findByRequestId(String requestId);

    List<WorkOrder> findByStatus(String status);

    List<WorkOrder> findByStatusInAndNextTransitionAtLessThanEqual(
            Collection<String> statuses, OffsetDateTime cutoff);
}
