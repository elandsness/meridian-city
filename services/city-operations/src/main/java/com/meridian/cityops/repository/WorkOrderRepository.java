package com.meridian.cityops.repository;

import com.meridian.cityops.domain.WorkOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkOrderRepository extends JpaRepository<WorkOrder, String> {

    List<WorkOrder> findByRequestId(String requestId);

    List<WorkOrder> findByStatus(String status);
}
