package com.meridian.cityops.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * Wire shape for an incident. The two frontends consume this defensively but
 * read specific snake_case keys (see docs/API_CONVENTIONS.md §1 and findings
 * #9–#10): public-portal reads {@code description}, {@code location_name} and a
 * nested {@code location {lat,lng}} for the map; ops-dashboard reads
 * {@code work_order_count} and {@code resolved_at}.
 *
 * city-operations runs the global Jackson SNAKE_CASE strategy (see
 * application.yml: spring.jackson.property-naming-strategy: SNAKE_CASE), so these
 * snake_case keys are emitted automatically. The per-field {@code @JsonProperty}
 * pins below are therefore belt-and-suspenders — each maps to exactly the name the
 * global strategy would produce, kept here to make the wire contract explicit at
 * the point the frontends depend on it.
 *
 * The cross-service DTOs that service-dispatch consumes as camelCase
 * (CreateWorkOrderDto, WorkOrderResponse) opt out of the global strategy via
 * {@code @JsonNaming(LowerCamelCaseStrategy)} instead.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class IncidentResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("asset_id")
    private String assetId;

    @JsonProperty("severity")
    private String severity;

    @JsonProperty("status")
    private String status;

    @JsonProperty("title")
    private String title;

    @JsonProperty("description")
    private String description;

    /** Human-readable zone name (e.g. "North District"); null when the asset/zone is unknown. */
    @JsonProperty("location_name")
    private String locationName;

    /** Derived map coordinate; null when the incident's asset/zone has no known location. */
    @JsonProperty("location")
    private Location location;

    /** Count of work orders linked to this incident (0 when none). */
    @JsonProperty("work_order_count")
    private long workOrderCount;

    @JsonProperty("created_at")
    private OffsetDateTime createdAt;

    @JsonProperty("resolved_at")
    private OffsetDateTime resolvedAt;

    /**
     * Map pin coordinate. The public-portal map (CityMap.jsx) plots
     * {@code location.lat} / {@code location.lng}.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Location {

        @JsonProperty("lat")
        private Double lat;

        @JsonProperty("lng")
        private Double lng;
    }
}
