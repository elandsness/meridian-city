package com.meridian.entityengine.repository;

import com.meridian.entityengine.domain.EntityRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EntityRecordRepository extends JpaRepository<EntityRecord, String> {

    List<EntityRecord> findByEntityType(String entityType);

    List<EntityRecord> findByEntityType(String entityType, Pageable pageable);

    List<EntityRecord> findByEntityTypeAndState(String entityType, String state);

    Optional<EntityRecord> findByIdAndEntityType(String id, String entityType);

    List<EntityRecord> findByEntityTypeInAndNextTransitionAtLessThanEqual(
            Collection<String> entityTypes, OffsetDateTime now, Pageable pageable);

    long countByEntityTypeAndStateNotIn(String entityType, Collection<String> states);

    List<EntityRecord> findByEntityTypeAndStateNotIn(String entityType, Collection<String> states);
}
