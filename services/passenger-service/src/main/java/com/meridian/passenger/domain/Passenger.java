package com.meridian.passenger.domain;

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
 * A passenger progressing through the departure journey. Status advances
 * checked_in → [bag_checked] → security_cleared → [bag_loaded] → boarded; the
 * bracketed steps only occur when {@link #hasBag} is true (see
 * {@link com.meridian.passenger.service.PassengerJourneyScheduler}).
 */
@Entity
@Table(schema = "passengers", name = "passengers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Passenger {

    @Id
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "booking_ref", nullable = false)
    private String bookingRef;

    @Column(name = "seat")
    private String seat;

    /** Best-effort link to a departing flight (may be null if flight-ops was unreachable). */
    @Column(name = "flight_id")
    private String flightId;

    @Column(name = "flight_number")
    private String flightNumber;

    @Column(name = "gate")
    private String gate;

    /** Citizen/user id that owns this personal journey; null for generator-created passengers. */
    @Column(name = "owner_id")
    private String ownerId;

    @Column(name = "has_bag", nullable = false)
    @Builder.Default
    private boolean hasBag = false;

    @Column(name = "status", nullable = false)
    @Builder.Default
    private String status = "checked_in";

    /** 0..1 journey completion, reserved for future visualisation. */
    @Column(name = "progress", nullable = false)
    @Builder.Default
    private double progress = 0.0;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "next_transition_at")
    private OffsetDateTime nextTransitionAt;

    public static Passenger create(String name, String bookingRef, String seat,
                                   String flightId, String flightNumber, String gate,
                                   boolean hasBag) {
        OffsetDateTime now = OffsetDateTime.now();
        return Passenger.builder()
                .id("pax-" + UUID.randomUUID().toString().substring(0, 5))
                .name(name)
                .bookingRef(bookingRef)
                .seat(seat)
                .flightId(flightId)
                .flightNumber(flightNumber)
                .gate(gate)
                .hasBag(hasBag)
                .status("checked_in")
                .progress(0.0)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
