package com.meridian.entityengine.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/** Append-only audit trail of every transition — what analytics-service reads. */
@Entity
@Table(schema = "entities", name = "entity_event")
@Getter
@Setter
@NoArgsConstructor
public class EntityEventRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "entity_id", nullable = false, length = 64)
    private String entityId;

    @Column(name = "entity_type", nullable = false, length = 64)
    private String entityType;

    @Column(name = "event_type", nullable = false, length = 128)
    private String eventType;

    @Column(name = "from_state", length = 64)
    private String fromState;

    @Column(name = "to_state", nullable = false, length = 64)
    private String toState;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false)
    private Map<String, Object> payload = new HashMap<>();

    @PrePersist
    protected void onCreate() {
        if (occurredAt == null) occurredAt = OffsetDateTime.now();
    }

    public static EntityEventRecord of(EntityRecord record, String fromState, String toState) {
        EntityEventRecord event = new EntityEventRecord();
        event.setEntityId(record.getId());
        event.setEntityType(record.getEntityType());
        event.setEventType(record.getEntityType() + "." + toState);
        event.setFromState(fromState);
        event.setToState(toState);
        return event;
    }
}
