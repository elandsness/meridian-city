package com.meridian.journey.dto;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public class Journey {
    private String id;
    private String entityType;
    private String name;
    private String relatedId;
    private String direction;
    private String origin;
    private String destination;
    private String status;
    private String state;
    private double progress;
    private double x;
    private double y;
    private List<JourneyStage> stages = new ArrayList<>();
    private OffsetDateTime scheduledAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public Journey() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getRelatedId() { return relatedId; }
    public void setRelatedId(String relatedId) { this.relatedId = relatedId; }
    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
    public String getOrigin() { return origin; }
    public void setOrigin(String origin) { this.origin = origin; }
    public String getDestination() { return destination; }
    public void setDestination(String destination) { this.destination = destination; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public double getProgress() { return progress; }
    public void setProgress(double progress) { this.progress = progress; }
    public double getX() { return x; }
    public void setX(double x) { this.x = x; }
    public double getY() { return y; }
    public void setY(double y) { this.y = y; }
    public List<JourneyStage> getStages() { return stages; }
    public void setStages(List<JourneyStage> stages) { this.stages = stages; }
    public OffsetDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(OffsetDateTime scheduledAt) { this.scheduledAt = scheduledAt; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
