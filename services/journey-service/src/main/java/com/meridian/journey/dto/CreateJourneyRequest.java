package com.meridian.journey.dto;

public class CreateJourneyRequest {

    private String entityType;
    private String name;
    private String relatedId;
    private String direction;
    private String origin;
    private String destination;
    private String metadata;
    private String initialStatus;

    private Double originX;
    private Double originY;
    private Double destX;
    private Double destY;

    public String getIdentityId() { return relatedId; }

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

    public String getMetadata() { return metadata; }
    public void setMetadata(String metadata) { this.metadata = metadata; }

    public String getInitialStatus() { return initialStatus; }
    public void setInitialStatus(String initialStatus) { this.initialStatus = initialStatus; }

    public Double getOriginX() { return originX; }
    public void setOriginX(Double originX) { this.originX = originX; }

    public Double getOriginY() { return originY; }
    public void setOriginY(Double originY) { this.originY = originY; }

    public Double getDestX() { return destX; }
    public void setDestX(Double destX) { this.destX = destX; }

    public Double getDestY() { return destY; }
    public void setDestY(Double destY) { this.destY = destY; }
}
