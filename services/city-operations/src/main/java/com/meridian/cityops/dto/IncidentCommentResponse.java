package com.meridian.cityops.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * Wire shape for an incident comment. Emitted as snake_case via the global
 * Jackson SNAKE_CASE strategy; the @JsonProperty pins make the contract explicit
 * (see IncidentResponse for the rationale).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class IncidentCommentResponse {

    @JsonProperty("id")
    private Long id;

    @JsonProperty("incident_id")
    private String incidentId;

    @JsonProperty("author")
    private String author;

    @JsonProperty("body")
    private String body;

    @JsonProperty("created_at")
    private OffsetDateTime createdAt;
}
