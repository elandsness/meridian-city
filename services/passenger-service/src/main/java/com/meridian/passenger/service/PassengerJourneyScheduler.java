package com.meridian.passenger.service;

import com.meridian.passenger.config.PassengerJourneyProperties;
import com.meridian.passenger.domain.Passenger;
import com.meridian.passenger.repository.PassengerRepository;
import com.meridian.passenger.util.BusinessEventLogger;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Advances passengers through the departure journey on a fixed poll. The next
 * status depends on whether the passenger checked a bag — the bag_checked and
 * bag_loaded steps are skipped for carry-on-only journeys:
 *
 *   with bag:    checked_in → bag_checked → security_cleared → bag_loaded → boarded
 *   without bag: checked_in → security_cleared → boarded
 *
 * A transition only fires once now &gt;= next_transition_at, so steps are spaced by
 * the configured random band (Passenger Journey Business Flow durations).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PassengerJourneyScheduler {

    /** Non-terminal statuses eligible to advance (boarded is terminal). */
    private static final List<String> ACTIVE = List.of(
            "checked_in", "bag_checked", "security_cleared", "bag_loaded");

    private final PassengerRepository repository;
    private final PassengerJourneyProperties journeyProps;
    private final BusinessEventLogger businessEvents;

    private static String nextStatus(String current, boolean hasBag) {
        return switch (current) {
            case "checked_in" -> hasBag ? "bag_checked" : "security_cleared";
            case "bag_checked" -> "security_cleared";
            case "security_cleared" -> hasBag ? "bag_loaded" : "boarded";
            case "bag_loaded" -> "boarded";
            default -> null; // boarded / unknown = terminal
        };
    }

    private static double progressFor(String status) {
        return switch (status) {
            case "checked_in" -> 0.2;
            case "bag_checked" -> 0.4;
            case "security_cleared" -> 0.6;
            case "bag_loaded" -> 0.8;
            case "boarded" -> 1.0;
            default -> 0.0;
        };
    }

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void advanceJourneys() {
        if (!journeyProps.isEnabled()) {
            return;
        }
        List<Passenger> due = repository.findByStatusInAndNextTransitionAtLessThanEqual(
                ACTIVE, OffsetDateTime.now());
        for (Passenger p : due) {
            advance(p);
        }
    }

    private void advance(Passenger p) {
        String next = nextStatus(p.getStatus(), p.isHasBag());
        OffsetDateTime now = OffsetDateTime.now();
        if (next == null) {
            p.setNextTransitionAt(null);
            repository.save(p);
            return;
        }
        p.setStatus(next);
        p.setProgress(progressFor(next));
        p.setUpdatedAt(now);
        p.setNextTransitionAt("boarded".equals(next)
                ? null
                : now.plusSeconds(journeyProps.nextDelaySeconds()));
        repository.save(p);
        businessEvents.passengerStatus(p);
    }
}
