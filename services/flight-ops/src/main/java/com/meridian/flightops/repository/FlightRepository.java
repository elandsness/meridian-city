package com.meridian.flightops.repository;

import com.meridian.flightops.domain.Flight;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FlightRepository extends JpaRepository<Flight, String> {

    /** Flights whose scheduled transition is due (drives the lifecycle scheduler). */
    List<Flight> findByStatusInAndNextTransitionAtLessThanEqual(List<String> statuses, OffsetDateTime ts);

    /** Live board, newest first. */
    List<Flight> findAllByOrderByScheduledAtDesc();

    List<Flight> findByStatus(String status);

    List<Flight> findByDirection(String direction);

    /** Active flights = not in a terminal status (for the generator's concurrency cap). */
    long countByStatusNotIn(List<String> terminalStatuses);
}
