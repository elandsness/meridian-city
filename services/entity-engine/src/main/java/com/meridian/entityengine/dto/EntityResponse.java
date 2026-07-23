package com.meridian.entityengine.dto;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.meridian.entityengine.domain.EntityRecord;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Flattens an EntityRecord's `data` fields to the top level (alongside id/state/
 * timestamps), the same flat shape today's hand-written *Response DTOs use
 * (e.g. FlightResponse: id, flight_number, direction, status, ..., updated_at
 * all flat, no nested "fields" object) -- generic across every entity type.
 */
public class EntityResponse {

    private final EntityRecord record;

    public EntityResponse(EntityRecord record) {
        this.record = record;
    }

    public String getId() { return record.getId(); }
    public String getEntityType() { return record.getEntityType(); }
    public String getState() { return record.getState(); }
    public OffsetDateTime getStateEnteredAt() { return record.getStateEnteredAt(); }
    public OffsetDateTime getNextTransitionAt() { return record.getNextTransitionAt(); }
    public String getOwnerId() { return record.getOwnerId(); }
    public OffsetDateTime getCreatedAt() { return record.getCreatedAt(); }
    public OffsetDateTime getUpdatedAt() { return record.getUpdatedAt(); }
    public Map<String, Object> getLinks() { return record.getLinks(); }

    @JsonAnyGetter
    public Map<String, Object> getData() {
        return record.getData();
    }
}
