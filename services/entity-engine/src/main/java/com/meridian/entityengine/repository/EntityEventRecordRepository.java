package com.meridian.entityengine.repository;

import com.meridian.entityengine.domain.EntityEventRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EntityEventRecordRepository extends JpaRepository<EntityEventRecord, Long> {
    List<EntityEventRecord> findByEntityIdOrderByOccurredAtAsc(String entityId);
}
