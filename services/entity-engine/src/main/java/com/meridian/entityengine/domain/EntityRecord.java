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
import java.util.Random;

/**
 * One row per entity instance, regardless of entity type — the generic, shared
 * storage the entity engine reads/writes. `data` and `links` are plain JSONB;
 * field typing is enforced in application code against the entity-config's
 * declared field types (see EntityDefinition), not DB constraints, so adding a
 * field to any entity type never requires a migration.
 */
@Entity
@Table(schema = "entities", name = "entity")
@Getter
@Setter
@NoArgsConstructor
public class EntityRecord {

    private static final String ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final Random RANDOM = new Random();

    @Id
    @Column(name = "id", length = 64)
    private String id;

    @Column(name = "entity_type", nullable = false, length = 64)
    private String entityType;

    @Column(name = "state", nullable = false, length = 64)
    private String state;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data", nullable = false)
    private Map<String, Object> data = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "links", nullable = false)
    private Map<String, Object> links = new HashMap<>();

    @Column(name = "state_entered_at", nullable = false)
    private OffsetDateTime stateEnteredAt;

    @Column(name = "next_transition_at")
    private OffsetDateTime nextTransitionAt;

    @Column(name = "owner_id", length = 64)
    private String ownerId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        if (stateEnteredAt == null) stateEnteredAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public static EntityRecord create(String entityType, String idPrefix, String initialState) {
        EntityRecord record = new EntityRecord();
        String prefix = (idPrefix == null || idPrefix.isBlank()) ? entityType : idPrefix;
        record.setId(prefix + "-" + generateSuffix());
        record.setEntityType(entityType);
        record.setState(initialState);
        return record;
    }

    /** Get a field value from `data`, or null. */
    public Object getField(String name) {
        return data.get(name);
    }

    public void setField(String name, Object value) {
        data.put(name, value);
    }

    public String getLink(String refField) {
        Object v = links.get(refField);
        return v == null ? null : String.valueOf(v);
    }

    public void setLink(String refField, String targetId) {
        links.put(refField, targetId);
    }

    private static String generateSuffix() {
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }
}
