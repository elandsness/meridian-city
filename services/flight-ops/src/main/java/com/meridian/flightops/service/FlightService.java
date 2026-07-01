package com.meridian.flightops.service;

import com.meridian.flightops.config.FlightLifecycleProperties;
import com.meridian.flightops.domain.Flight;
import com.meridian.flightops.repository.FlightRepository;
import com.meridian.flightops.util.BusinessEventLogger;
import java.time.OffsetDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FlightService {

    private final FlightRepository flightRepository;
    private final BusinessEventLogger businessEventLogger;
    private final FlightLifecycleProperties props;

    /** Persist a new flight, schedule its first transition, and emit its opening event. */
    @Transactional
    public Flight create(Flight flight) {
        flight.setNextTransitionAt(OffsetDateTime.now().plusSeconds(props.nextDelaySeconds()));
        Flight saved = flightRepository.save(flight);
        businessEventLogger.flightStatus(saved); // opening status = first Business-Flow step
        return saved;
    }

    /** Live board, newest first. */
    public List<Flight> board() {
        return flightRepository.findAllByOrderByScheduledAtDesc();
    }

    public Flight findById(String id) {
        return flightRepository.findById(id).orElse(null);
    }

    public List<Flight> byStatus(String status) {
        return flightRepository.findByStatus(status);
    }

    public List<Flight> byDirection(String direction) {
        return flightRepository.findByDirection(direction);
    }
}
