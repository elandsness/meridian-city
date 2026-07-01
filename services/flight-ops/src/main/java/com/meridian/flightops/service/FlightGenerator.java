package com.meridian.flightops.service;

import com.meridian.flightops.domain.Flight;
import com.meridian.flightops.repository.FlightRepository;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps a busy, always-on flight board by creating new departures and arrivals up to
 * a concurrency cap. Data is airport-flavored but generic (no real schedules).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FlightGenerator {

    private static final String HOME = "MER"; // Meridian Airport
    private static final String[] AIRLINE_NAMES = {"Meridian Air", "Skyline", "Northwind", "Aterna", "Coastal"};
    private static final String[] AIRLINE_CODES = {"MA", "SK", "NW", "AT", "CO"};
    private static final String[] AIRPORTS = {"SFO", "JFK", "LHR", "NRT", "DXB", "LAX", "ORD", "CDG", "SIN", "AMS"};
    private static final String[] AIRCRAFT = {"A320", "A321", "B737", "B738", "E190", "A350", "B777"};
    private static final String[] GATES = {"A1", "A3", "A10", "B7", "B12", "C4", "C9", "D2", "D8"};
    private static final String[] STANDS = {"R1", "R2", "R5", "S3", "S8", "T4", "T9"};
    private static final List<String> TERMINAL = List.of("departed", "arrived");

    private final FlightService flightService;
    private final FlightRepository flightRepository;

    @Value("${flight-generator.enabled:true}")
    private boolean enabled;

    @Value("${flight-generator.max-active:16}")
    private int maxActive;

    @Scheduled(fixedDelayString = "${flight-generator.interval-ms:25000}")
    public void generate() {
        if (!enabled) {
            return;
        }
        if (flightRepository.countByStatusNotIn(TERMINAL) >= maxActive) {
            return;
        }
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        boolean departure = rnd.nextBoolean();
        int ai = rnd.nextInt(AIRLINE_NAMES.length);
        String other = AIRPORTS[rnd.nextInt(AIRPORTS.length)];

        Flight f = Flight.create(
                AIRLINE_CODES[ai] + rnd.nextInt(100, 1000),
                AIRLINE_NAMES[ai],
                departure ? "departure" : "arrival",
                departure ? HOME : other,
                departure ? other : HOME,
                GATES[rnd.nextInt(GATES.length)],
                STANDS[rnd.nextInt(STANDS.length)],
                AIRCRAFT[rnd.nextInt(AIRCRAFT.length)],
                departure ? "at_gate" : "approach");
        flightService.create(f);
    }
}
