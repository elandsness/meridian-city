package com.meridian.dispatch.repository;

import com.meridian.dispatch.domain.DispatchLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DispatchLogRepository extends JpaRepository<DispatchLog, Long> {

    List<DispatchLog> findByRequestId(String requestId);
}
