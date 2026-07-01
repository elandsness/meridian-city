package com.meridian.passenger.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.meridian.passenger.domain.Passenger;
import java.time.OffsetDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PassengerResponse {

    @JsonProperty("id")
    private String id;

    @JsonProperty("name")
    private String name;

    @JsonProperty("booking_ref")
    private String bookingRef;

    @JsonProperty("seat")
    private String seat;

    @JsonProperty("flight_id")
    private String flightId;

    @JsonProperty("flight_number")
    private String flightNumber;

    @JsonProperty("gate")
    private String gate;

    @JsonProperty("has_bag")
    private boolean hasBag;

    @JsonProperty("status")
    private String status;

    @JsonProperty("progress")
    private double progress;

    @JsonProperty("created_at")
    private OffsetDateTime createdAt;

    @JsonProperty("updated_at")
    private OffsetDateTime updatedAt;

    public static PassengerResponse from(Passenger p) {
        return PassengerResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .bookingRef(p.getBookingRef())
                .seat(p.getSeat())
                .flightId(p.getFlightId())
                .flightNumber(p.getFlightNumber())
                .gate(p.getGate())
                .hasBag(p.isHasBag())
                .status(p.getStatus())
                .progress(p.getProgress())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}
