package com.meridian.journey.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Emitted/consumed as snake_case via the global Jackson SNAKE_CASE strategy. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateJourneyRequest {

    private String entityType;
    private String name;
    private String relatedId;
    private String direction;
    private String origin;
    private String destination;
    private String metadata;
    private String initialStatus;

    /** Optional map coordinates — see Journey#originX for the coordinate space. */
    private Double originX;
    private Double originY;
    private Double destX;
    private Double destY;
}
