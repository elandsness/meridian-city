package com.meridian.passenger.service;

import com.meridian.passenger.config.PassengerJourneyProperties;
import com.meridian.passenger.domain.Passenger;
import com.meridian.passenger.repository.PassengerRepository;
import com.meridian.passenger.util.BusinessEventLogger;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

@Service
@Slf4j
public class PassengerService {

    private static final String ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private final PassengerRepository repository;
    private final PassengerJourneyProperties journeyProps;
    private final BusinessEventLogger businessEvents;
    private final RestClient flightOpsClient;

    public PassengerService(PassengerRepository repository,
                            PassengerJourneyProperties journeyProps,
                            BusinessEventLogger businessEvents,
                            @Value("${flight-ops.url:http://localhost:8092}") String flightOpsUrl) {
        this.repository = repository;
        this.journeyProps = journeyProps;
        this.businessEvents = businessEvents;
        this.flightOpsClient = RestClient.builder().baseUrl(flightOpsUrl).build();
    }

    /** Persist a new passenger, schedule its first journey transition, emit the opening event. */
    @Transactional
    public Passenger create(Passenger passenger) {
        passenger.setNextTransitionAt(OffsetDateTime.now().plusSeconds(journeyProps.nextDelaySeconds()));
        Passenger saved = repository.save(passenger);
        businessEvents.passengerStatus(saved);
        return saved;
    }

    /** Build + persist a new passenger, best-effort linked to a departing flight. */
    @Transactional
    public Passenger spawn(String name, boolean hasBag, String ownerId) {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        DepartingFlight flight = pickDepartingFlight();
        String seat = (1 + rnd.nextInt(40)) + String.valueOf(ALPHANUM.charAt(rnd.nextInt(6)));
        String bookingRef = "MER-" + randomAlphaNum(6);
        Passenger p = Passenger.create(
                (name != null && !name.isBlank()) ? name : "Passenger",
                bookingRef, seat,
                flight != null ? flight.id() : null,
                flight != null ? flight.number() : null,
                flight != null ? flight.gate() : null,
                hasBag);
        p.setOwnerId(ownerId);
        return create(p);
    }

    /** The journey owned by a specific user, creating a fresh one if none is in progress. */
    @Transactional
    public Passenger getOrCreateForOwner(String ownerId, String name) {
        return repository.findFirstByOwnerIdOrderByCreatedAtDesc(ownerId)
                .filter(p -> !"boarded".equals(p.getStatus()))
                .orElseGet(() -> spawn(name, ThreadLocalRandom.current().nextBoolean(), ownerId));
    }

    @Transactional(readOnly = true)
    public List<Passenger> board() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public Passenger findById(String id) {
        return repository.findById(id).orElse(null);
    }

    @Transactional(readOnly = true)
    public List<Passenger> byStatus(String status) {
        return repository.findByStatus(status);
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
                return new DepartingFlight(asString(f.get("id")), asString(f.get("flight_number")), asString(f.get("gate")));
            }
            return null;
        } catch (Exception e) {
            log.debug("flight-ops link unavailable ({}); creating unlinked passenger", e.getMessage());
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
