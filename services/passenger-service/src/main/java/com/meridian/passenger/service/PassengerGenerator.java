package com.meridian.passenger.service;

import com.meridian.passenger.domain.Passenger;
import com.meridian.passenger.repository.PassengerRepository;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Keeps a steady, always-on stream of passengers checking in and moving through the
 * journey, up to a configurable in-progress cap. Each new passenger is best-effort
 * linked to a real departing flight from flight-ops so the two hero flows correlate;
 * if flight-ops is unreachable the passenger is created unlinked (never crashes).
 */
@Component
@Slf4j
public class PassengerGenerator {

    private static final List<String> TERMINAL = List.of("boarded");

    private static final String[] FIRST = {
        "Ava", "Liam", "Noah", "Emma", "Olivia", "Sofia", "Kai", "Mateo",
        "Priya", "Wei", "Fatima", "Diego", "Lena", "Omar", "Chloe", "Yuki"
    };
    private static final String[] LAST = {
        "Nguyen", "Patel", "Garcia", "Kim", "Johnson", "Silva", "Haddad",
        "Muller", "Rossi", "Okafor", "Tanaka", "Novak", "Reyes", "Andersson"
    };
    private static final String[] SEAT_LETTERS = {"A", "B", "C", "D", "E", "F"};
    private static final String ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private final PassengerRepository repository;
    private final PassengerService passengerService;
    private final RestClient flightOpsClient;
    private final double bagProbability;
    private final boolean enabled;
    private final int maxActive;

    public PassengerGenerator(PassengerRepository repository,
                              PassengerService passengerService,
                              @Value("${flight-ops.url:http://localhost:8092}") String flightOpsUrl,
                              @Value("${passenger-generator.bag-probability:0.6}") double bagProbability,
                              @Value("${passenger-generator.enabled:true}") boolean enabled,
                              @Value("${passenger-generator.max-active:40}") int maxActive) {
        this.repository = repository;
        this.passengerService = passengerService;
        this.flightOpsClient = RestClient.builder().baseUrl(flightOpsUrl).build();
        this.bagProbability = bagProbability;
        this.enabled = enabled;
        this.maxActive = maxActive;
    }

    @Scheduled(fixedDelayString = "${passenger-generator.interval-ms:15000}")
    public void generate() {
        if (!enabled) {
            return;
        }
        long active = repository.countByStatusNotIn(TERMINAL);
        if (active >= maxActive) {
            return;
        }
        int toCreate = Math.min(3, maxActive - (int) active);
        DepartingFlight flight = pickDepartingFlight();
        for (int i = 0; i < toCreate; i++) {
            createPassenger(flight);
        }
    }

    private void createPassenger(DepartingFlight flight) {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        String name = FIRST[rnd.nextInt(FIRST.length)] + " " + LAST[rnd.nextInt(LAST.length)];
        String bookingRef = "MER-" + randomAlphaNum(6);
        String seat = (1 + rnd.nextInt(40)) + SEAT_LETTERS[rnd.nextInt(SEAT_LETTERS.length)];
        boolean hasBag = rnd.nextDouble() < bagProbability;

        Passenger passenger = Passenger.create(
                name, bookingRef, seat,
                flight != null ? flight.id() : null,
                flight != null ? flight.number() : null,
                flight != null ? flight.gate() : null,
                hasBag);
        passengerService.create(passenger);
    }

    /** Best-effort: pick a random departing flight from flight-ops for correlation. */
    private DepartingFlight pickDepartingFlight() {
        try {
            List<?> flights = flightOpsClient.get()
                    .uri("/api/v1/flights?direction=departure")
                    .retrieve()
                    .body(List.class);
            if (flights == null || flights.isEmpty()) {
                return null;
            }
            Object item = flights.get(ThreadLocalRandom.current().nextInt(flights.size()));
            if (item instanceof Map<?, ?> f) {
                return new DepartingFlight(
                        asString(f.get("id")),
                        asString(f.get("flight_number")),
                        asString(f.get("gate")));
            }
            return null;
        } catch (Exception e) {
            log.debug("flight-ops link unavailable ({}); creating unlinked passengers", e.getMessage());
            return null;
        }
    }

    private static String asString(Object o) {
        return o == null ? null : o.toString();
    }

    private static String randomAlphaNum(int len) {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) {
            sb.append(ALPHANUM.charAt(rnd.nextInt(ALPHANUM.length())));
        }
        return sb.toString();
    }

    private record DepartingFlight(String id, String number, String gate) {}
}
