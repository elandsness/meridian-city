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

@Entity
@Table(schema = "journey", name = "journeys")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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

    @Builder.Default
    private String status = "initiated";

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