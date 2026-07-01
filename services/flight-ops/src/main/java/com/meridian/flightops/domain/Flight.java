package com.meridian.flightops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A flight moving through its operational lifecycle.
 *
 * <p>Departures: at_gate → servicing → boarding → taxiing → takeoff → departed.
 * Arrivals:   approach → landing → taxi_in → at_gate → arrived.
 *
 * <p>{@code nextTransitionAt} is what the {@link com.meridian.flightops.service.FlightLifecycleScheduler}
 * polls to advance the status; {@code progress} (0..1 along the current segment) is
 * carried for the future airfield map.
 */
@Entity
@Table(schema = "flights", name = "flights")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Flight {

    @Id
    private String id; // "flt-<5-char-uuid>"

    @Column(name = "flight_number", nullable = false)
    private String flightNumber;

    private String airline;

    @Column(nullable = false)
    private String direction; // "departure" | "arrival"

    private String origin;
    private String destination;
    private String gate;
    private String stand;

    @Column(name = "aircraft_type")
    private String aircraftType;

    @Column(nullable = false)
    @Builder.Default
    private String status = "at_gate";

    @Builder.Default
    private double progress = 0.0; // 0..1 along the current lifecycle segment (for the map)

    @Column(name = "scheduled_at")
    private OffsetDateTime scheduledAt;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "next_transition_at")
    private OffsetDateTime nextTransitionAt;

    public static Flight create(String flightNumber, String airline, String direction,
                                String origin, String destination, String gate, String stand,
                                String aircraftType, String initialStatus) {
        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 5);
        OffsetDateTime now = OffsetDateTime.now();
        return Flight.builder()
                .id("flt-" + shortId)
                .flightNumber(flightNumber)
                .airline(airline)
                .direction(direction)
                .origin(origin)
                .destination(destination)
                .gate(gate)
                .stand(stand)
                .aircraftType(aircraftType)
                .status(initialStatus)
                .progress(0.0)
                .scheduledAt(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
