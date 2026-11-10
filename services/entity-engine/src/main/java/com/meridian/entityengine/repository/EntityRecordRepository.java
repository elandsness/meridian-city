package com.meridian.entityengine.repository;

import com.meridian.entityengine.domain.EntityRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EntityRecordRepository extends JpaRepository<EntityRecord, String> {

    List<EntityRecord> findByEntityType(String entityType);

    List<EntityRecord> findByEntityType(String entityType, Pageable pageable);

    // Used by the client-facing list endpoint so result order is stable instead of
    // whatever order Postgres happens to return for an unordered scan.
    List<EntityRecord> findByEntityTypeOrderByCreatedAtAsc(String entityType);

    List<EntityRecord> findByEntityTypeAndState(String entityType, String state, Pageable pageable);

    List<EntityRecord> findByEntityTypeAndStateOrderByCreatedAtAsc(String entityType, String state);

    @Query(value = "SELECT * FROM entity_records WHERE entity_type = :entityType AND state NOT IN :states ORDER BY random() LIMIT 1", nativeQuery = true)
    Optional<EntityRecord> findRandomByEntityTypeAndStateNotIn(@Param("entityType") String entityType, @Param("states") Collection<String> states);

    Optional<EntityRecord> findByIdAndEntityType(String id, String entityType);

    List<EntityRecord> findByEntityTypeInAndNextTransitionAtLessThanEqual(
            Collection<String> entityTypes, OffsetDateTime now, Pageable pageable);

    long countByEntityTypeAndStateNotIn(String entityType, Collection<String> states);

    List<EntityRecord> findByEntityTypeAndStateNotIn(String entityType, Collection<String> states, Pageable pageable);
    List<EntityRecord> findByEntityTypeAndStateNotIn(String entityType, Collection<String> states);
}
