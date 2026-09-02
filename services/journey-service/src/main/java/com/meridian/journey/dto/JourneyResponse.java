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
    private double progress;
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
}
