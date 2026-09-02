package com.meridian.journey.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Journey configuration — defines the stages, transitions, and rules for a journey type.
 * Configurable per industry (airport, hospital, bank, etc.).
 */
@Entity
@Table(schema = "journey", name = "journey_configs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JourneyConfig {

    @Id
    private String id;

    /** Entity type this config applies to (e.g., "flight", "passenger"). */
    @Column(name = "entity_type")
    private String entityType;

    /** Display name for this journey type. */
    private String name;

    /** JSON array of stages: [{"name": "at_gate", "order": 1, "progress": 0.1}, ...] */
    @Column(columnDefinition = "jsonb")
    private String stages;

    /** Transition rules: {"at_gate": "servicing", "servicing": "boarding", ...} */
    @Column(columnDefinition = "jsonb")
    private String transitions;

    /** Fault injection rules: {"boarding": {"failure_rate": 0.1}} */
    @Column(columnDefinition = "jsonb")
    private String faultRules;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    /** Factory — generates id like "jcfg-a1b2c". */
    public static JourneyConfig create(String entityType, String name, String stages,
                                       String transitions, String faultRules) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        return JourneyConfig.builder()
                .id("jcfg-" + shortId)
                .entityType(entityType)
                .name(name)
                .stages(stages)
                .transitions(transitions)
                .faultRules(faultRules)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}
