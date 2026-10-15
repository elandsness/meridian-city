package com.meridian.journey.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Generic journey entity — replaces the former Flight and Passenger entities.
 * Configurable stages, transitions, and position interpolation driven by industry
 * config rather than hardcoded domain concepts.
 */
@Entity
@Table(schema = "journey", name = "journeys")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Journey {

    @Id
    private String id;

    /** Entity type: "flight", "passenger", "patient", "loan", etc. */
    @Column(name = "entity_type")
    private String entityType;

    /** Display name (e.g., flight number, passenger name). */
    private String name;

    /** Best-effort link to a related entity (e.g., flight_id for passengers). */
    @Column(name = "related_id")
    private String relatedId;

    /** The internal identity ID of the user this journey belongs to. */
    @Column(name = "user_id")
    private String userId;

    /** Direction or category (e.g., "departure", "arrival", "inbound", "outbound"). */
    private String direction;

    /** Origin (e.g., origin airport, origin department). */
    private String origin;

    /** Destination (e.g., destination airport, destination department). */
    private String destination;

    /** Additional metadata (e.g., gate, stand, seat, aircraft type). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String metadata;

    @Builder.Default
    private String status = "initiated";

    /** 0..1 journey completion. Drives the interpolated position below. */
    @Builder.Default
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

    /** Factory — generates id like "jrn-a1b2c". */
    public static Journey create(String entityType, String name, String userId, String relatedId,
                                 String direction, String origin, String destination,
                                 String metadata, String initialStatus) {
        return create(entityType, name, userId, relatedId, direction, origin, destination,
                metadata, initialStatus, null, null, null, null);
    }

    /** Factory with map coordinates. */
    public static Journey create(String entityType, String name, String userId, String relatedId,
                                 String direction, String origin, String destination,
                                 String metadata, String initialStatus,
                                 Double originX, Double originY, Double destX, Double destY) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        OffsetDateTime now = OffsetDateTime.now();
        return Journey.builder()
                .id("jrn-" + shortId)
                .entityType(entityType)
                .name(name)
                .userId(userId)
                .relatedId(relatedId)
                .direction(direction)
                .origin(origin)
                .destination(destination)
                .metadata(metadata)
                .status(initialStatus)
                .progress(0.0)
                .originX(originX)
                .originY(originY)
                .destX(destX)
                .destY(destY)
                .scheduledAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}