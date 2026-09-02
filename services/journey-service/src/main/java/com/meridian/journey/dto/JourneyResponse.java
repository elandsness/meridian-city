package com.meridian.journey.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;

/** Emitted as snake_case via the global Jackson SNAKE_CASE strategy. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JourneyResponse {

    private String id;
    private String entityType;
    private String name;
    private String relatedId;
    private String direction;
    private String origin;
    private String destination;
    private String status;
    /** Mirrors `status` — lets a generic map/list consumer key off `state` the same
     * way every other entity type does, without journey-specific code. */
    private String state;
    private double progress;
    /** Null unless the journey has map coordinates (see Journey#originX). */
    private Position position;
    private List<Stage> stages;
    private OffsetDateTime scheduledAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Stage {
        private String stageName;
        private int stageOrder;
        private double progress;
        private OffsetDateTime enteredAt;
        private OffsetDateTime exitedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Position {
        private double x;
        private double y;
    }
}
