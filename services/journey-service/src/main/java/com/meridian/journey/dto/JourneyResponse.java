package com.meridian.journey.dto;

import java.time.OffsetDateTime;
import java.util.List;

public class JourneyResponse {

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
    private Position position;
    private List<Stage> stages;
    private OffsetDateTime scheduledAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    public JourneyResponse() {}

    public JourneyResponse(String id, String entityType, String name, String relatedId, String direction, String origin, String destination, String status, String state, double progress, Position position, List<Stage> stages, OffsetDateTime scheduledAt, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
        this.id = id;
        this.entityType = entityType;
        this.name = name;
        this.relatedId = relatedId;
        this.direction = direction;
        this.origin = origin;
        this.destination = destination;
        this.status = status;
        this.state = state;
        this.progress = progress;
        this.position = position;
        this.stages = stages;
        this.scheduledAt = scheduledAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
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
        private Position position;
        private List<Stage> stages;
        private OffsetDateTime scheduledAt;
        private OffsetDateTime createdAt;
        private OffsetDateTime updatedAt;

        public Builder id(String id) { this.id = id; return this; }
        public Builder entityType(String entityType) { this.entityType = entityType; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder relatedId(String relatedId) { this.relatedId = relatedId; return this; }
        public Builder direction(String direction) { this.direction = direction; return this; }
        public Builder origin(String origin) { this.origin = origin; return this; }
        public Builder destination(String destination) { this.destination = destination; return this; }
        public Builder status(String status) { this.status = status; return this; }
        public Builder state(String state) { this.state = state; return this; }
        public Builder progress(double progress) { this.progress = progress; return this; }
        public Builder position(Position position) { this.position = position; return this; }
        public Builder stages(List<Stage> stages) { this.stages = stages; return this; }
        public Builder scheduledAt(OffsetDateTime scheduledAt) { this.scheduledAt = scheduledAt; return this; }
        public Builder createdAt(OffsetDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public JourneyResponse build() {
            return new JourneyResponse(id, entityType, name, relatedId, direction, origin, destination, status, state, progress, position, stages, scheduledAt, createdAt, updatedAt);
        }
    }

    // Getters and Setters
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
    public Position getPosition() { return position; }
    public void setPosition(Position position) { this.position = position; }
    public List<Stage> getStages() { return stages; }
    public void setStages(List<Stage> stages) { this.stages = stages; }
    public OffsetDateTime getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(OffsetDateTime scheduledAt) { this.scheduledAt = scheduledAt; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static class Stage {
        private String stageName;
        private int stageOrder;
        private double progress;
        private OffsetDateTime enteredAt;
        private OffsetDateTime exitedAt;

        public Stage() {}
        public Stage(String stageName, int stageOrder, double progress, OffsetDateTime enteredAt, OffsetDateTime exitedAt) {
            this.stageName = stageName;
            this.stageOrder = stageOrder;
            this.progress = progress;
            this.enteredAt = enteredAt;
            this.exitedAt = exitedAt;
        }

        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private String stageName;
            private int stageOrder;
            private double progress;
            private OffsetDateTime enteredAt;
            private OffsetDateTime exitedAt;
            public Builder stageName(String s) { this.stageName = s; return this; }
            public Builder stageOrder(int o) { this.stageOrder = o; return this; }
            public Builder progress(double p) { this.progress = p; return this; }
            public Builder enteredAt(OffsetDateTime e) { this.enteredAt = e; return this; }
            public Builder exitedAt(OffsetDateTime e) { this.exitedAt = e; return this; }
            public Stage build() { return new Stage(stageName, stageOrder, progress, enteredAt, exitedAt); }
        }

        public String getStageName() { return stageName; }
        public void setStageName(String stageName) { this.stageName = stageName; }
        public int getStageOrder() { return stageOrder; }
        public void setStageOrder(int stageOrder) { this.stageOrder = stageOrder; }
        public double getProgress() { return progress; }
        public void setProgress(double progress) { this.progress = progress; }
        public OffsetDateTime getEnteredAt() { return enteredAt; }
        public void setEnteredAt(OffsetDateTime enteredAt) { this.enteredAt = enteredAt; }
        public OffsetDateTime getExitedAt() { return exitedAt; }
        public void setExitedAt(OffsetDateTime exitedAt) { this.exitedAt = exitedAt; }
    }

    public static class Position {
        private double x;
        private double y;

        public Position() {}
        public Position(double x, double y) { this.x = x; this.y = y; }

        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private double x;
            private double y;
            public Builder x(double x) { this.x = x; return this; }
            public Builder y(double y) { this.y = y; return this; }
            public Position build() { return new Position(x, y); }
        }

        public double getX() { return x; }
        public void setX(double x) { this.x = x; }
        public double getY() { return y; }
        public void setY(double y) { this.y = y; }
    }
}
