package com.meridian.flightops.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.meridian.flightops.domain.Flight;
import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** HTTP response for a flight (snake_case at the boundary). */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FlightResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("flight_number")
    private String flightNumber;

    @JsonProperty("airline")
    private String airline;

    @JsonProperty("direction")
    private String direction;

    @JsonProperty("origin")
    private String origin;

    @JsonProperty("destination")
    private String destination;

    @JsonProperty("gate")
    private String gate;

    @JsonProperty("stand")
    private String stand;

    @JsonProperty("aircraft_type")
    private String aircraftType;

    @JsonProperty("status")
    private String status;

    @JsonProperty("progress")
    private double progress;

    @JsonProperty("scheduled_at")
    private OffsetDateTime scheduledAt;

    @JsonProperty("updated_at")
    private OffsetDateTime updatedAt;

    public static FlightResponse from(Flight f) {
        return FlightResponse.builder()
                .id(f.getId())
                .flightNumber(f.getFlightNumber())
                .airline(f.getAirline())
                .direction(f.getDirection())
                .origin(f.getOrigin())
                .destination(f.getDestination())
                .gate(f.getGate())
                .stand(f.getStand())
                .aircraftType(f.getAircraftType())
                .status(f.getStatus())
                .progress(f.getProgress())
                .scheduledAt(f.getScheduledAt())
                .updatedAt(f.getUpdatedAt())
                .build();
    }
}
