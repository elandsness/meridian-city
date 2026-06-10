package com.meridian.cityops.repository;

import com.meridian.cityops.domain.WorkOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface WorkOrderRepository extends JpaRepository<WorkOrder, String> {

    List<WorkOrder> findByRequestId(String requestId);

    List<WorkOrder> findByStatus(String status);

    /** Batch fetch for work-order counts per incident (avoids an N+1 over incidents). */
    List<WorkOrder> findByIncidentIdIn(Collection<String> incidentIds);
}
