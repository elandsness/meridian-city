package com.meridian.flightops.service;

import com.meridian.flightops.config.FaultState;
import com.meridian.flightops.config.FlightLifecycleProperties;
import com.meridian.flightops.domain.Flight;
import com.meridian.flightops.repository.FlightRepository;
import com.meridian.flightops.util.BusinessEventLogger;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Advances flights through their lifecycle on a timer, spacing each transition by a
 * random delay (see {@link FlightLifecycleProperties}) so the aircraft-turnaround
 * Business Flow steps are realistically spaced. Departures and arrivals follow
 * separate status chains; terminal statuses (departed/arrived) stop advancing.
 * When fault injection is on, a share of departing flights are cancelled at boarding.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FlightLifecycleScheduler {

    // status -> next status. A status absent as a key is terminal.
    private static final Map<String, String> NEXT = Map.of(
            "at_gate", "servicing",
            "servicing", "boarding",
            "boarding", "taxiing",
            "taxiing", "takeoff",
            "takeoff", "departed",
            "approach", "landing",
            "landing", "taxi_in",
            "taxi_in", "arrived"
    );

    private final FlightRepository flightRepository;
    private final BusinessEventLogger businessEventLogger;
    private final FlightLifecycleProperties props;
    private final FaultState faultState;

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void advanceFlights() {
        if (!props.isEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        List<Flight> due = flightRepository.findByStatusInAndNextTransitionAtLessThanEqual(
                new ArrayList<>(NEXT.keySet()), now);
        for (Flight f : due) {
            try {
                advance(f, now);
            } catch (RuntimeException ex) {
                log.warn("Flight advance failed for id={}: {}", f.getId(), ex.getMessage());
            }
        }
    }

    private void advance(Flight f, OffsetDateTime now) {
        if (shouldCancel(f)) {
            f.setStatus("cancelled");
            f.setUpdatedAt(now);
            f.setNextTransitionAt(null); // terminal — stop polling it
            flightRepository.save(f);
            businessEventLogger.flightStatus(f); // gated demo failure — emits flight.cancelled
            return;
        }
        String next = NEXT.get(f.getStatus());
        if (next == null) {
            f.setNextTransitionAt(null); // terminal — stop polling it
            flightRepository.save(f);
            return;
        }
        f.setStatus(next);
        f.setProgress(0.0);
        f.setUpdatedAt(now);
        boolean terminal = !NEXT.containsKey(next);
        f.setNextTransitionAt(terminal ? null : now.plusSeconds(props.nextDelaySeconds()));
        flightRepository.save(f);
        businessEventLogger.flightStatus(f);
    }

    /** Gated demo failure: cancel a share of departing flights at boarding. */
    private boolean shouldCancel(Flight f) {
        return faultState.isFailuresEnabled()
                && "departure".equals(f.getDirection())
                && "boarding".equals(f.getStatus())
                && ThreadLocalRandom.current().nextDouble() < faultState.getFailureRate();
    }
}
