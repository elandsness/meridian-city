package com.meridian.journey.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(schema = "journey", name = "journeys")
public class Journey {

    @Id
    private String id;

    @Column(name = "entity_type")
    private String entityType;

    private String name;

    @Column(name = "related_id")
    private String relatedId;

    @Column(name = "user_id")
    private String userId;

    private String direction;

    private String origin;

    private String destination;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String metadata;

    private String status = "initiated";

    private double progress = 0.0;

    @Column(name = "origin_x")
    private Double originX;

    @Column(name = "origin_y")
    private Double originY;

    @Column(name = "dest_x")
    private Double destX;

    @Column(name = "dest_y")
    private Double destY;

    @Column(name = "scheduled_at")
    private OffsetDateTime scheduledAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "next_transition_at")
    private OffsetDateTime nextTransitionAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRelatedId() { return relatedId; }
    public void setRelatedId(String relatedId) { this.relatedId = relatedId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }

    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }

    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public double getProgress() { return progress; }
    public void setProgress(double progress) { this.progress = progress; }

    public Double getOriginX() { return originX; }
    public void setOriginX(Double originX) { this.originX = originX; }

    public Double getOriginY() { return originY; }
    public void setOriginY(Double originY) { this.originY = originY; }

    public Double getDestX() { return destX; }
    public void setDestX(Double destX) { this.destX = destX; }

    public Double getDestY() { return destY; }
    public void setDestY(Double destY) { this.destY = destY; }

    public OffsetDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(OffsetDateTime scheduledAt) { this.scheduledAt = scheduledAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public OffsetDateTime getNextTransitionAt() { return nextTransitionAt; }
    public void setNextTransitionAt(OffsetDateTime nextTransitionAt) { this.nextTransitionAt = nextTransitionAt; }

    public static Journey create(String entityType, String name, String userId, String relatedId,
                                 String direction, String origin, String destination,
                                 String metadata, String initialStatus) {
        return create(entityType, name, userId, relatedId, direction, origin, destination,
                metadata, initialStatus, null, null, null, null);
    }

    public static Journey create(String entityType, String name, String userId, String relatedId,
                                 String direction, String origin, String destination,
                                 String metadata, String initialStatus,
                                 Double originX, Double originY, Double destX, Double destY) {
        Journey j = new Journey();
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        OffsetDateTime now = OffsetDateTime.now();
        j.setId("jrn-" + shortId);
        j.setEntityType(entityType);
        j.setName(name);
        j.setUserId(userId);
        j.setRelatedId(relatedId);
        j.setDirection(direction);
        j.setOrigin(origin);
        j.setDestination(destination);
        j.setMetadata(metadata);
        j.setStatus(initialStatus);
        j.setProgress(0.0);
        j.setOriginX(originX);
        j.setOriginY(originY);
        j.setDestX(destX);
        j.setDestY(destY);
        j.setScheduledAt(now);
        j.setCreatedAt(now);
        j.setUpdatedAt(now);
        return j;
    }
}
