package com.meridian.journey.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "journey", name = "journey_configs")
public class JourneyConfig {

    @Id
    private String id;

    @Column(name = "entity_type")
    private String entityType;

    private String name;

    @Column(columnDefinition = "jsonb")
    private String stages;

    @Column(columnDefinition = "jsonb")
    private String transitions;

    @Column(columnDefinition = "jsonb")
    private String faultRules;

    @Column(name = "is_user_linked")
    private boolean isUserLinked = false;

    @Column(name = "owner_field")
    private String ownerField;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getStages() { return stages; }
    public void setStages(String stages) { this.stages = stages; }

    public String getTransitions() { return transitions; }
    public void setTransitions(String transitions) { this.transitions = transitions; }

    public String getFaultRules() { return faultRules; }
    public void setFaultRules(String faultRules) { this.faultRules = faultRules; }

    public boolean isUserLinked() { return isUserLinked; }
    public void setUserLinked(boolean userLinked) { this.isUserLinked = userLinked; }

    public String getOwnerField() { return ownerField; }
    public void setOwnerField(String ownerField) { this.ownerField = ownerField; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public static JourneyConfig create(String entityType, String name, String stages,
                                       String transitions, String faultRules) {
        JourneyConfig cfg = new JourneyConfig();
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        cfg.setId("jcfg-" + shortId);
        cfg.setEntityType(entityType);
        cfg.setName(name);
        cfg.setStages(stages);
        cfg.setTransitions(transitions);
        cfg.setFaultRules(faultRules);
        cfg.setCreatedAt(OffsetDateTime.now());
        return cfg;
    }
}
