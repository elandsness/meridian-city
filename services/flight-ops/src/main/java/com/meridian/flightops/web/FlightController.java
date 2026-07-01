package com.meridian.flightops.web;

import com.meridian.flightops.domain.Flight;
import com.meridian.flightops.dto.FlightResponse;
import com.meridian.flightops.service.FlightService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/flights")
@RequiredArgsConstructor
public class FlightController {

    private final FlightService flightService;

    /** Live flight board. Optional ?status= or ?direction= filters (both optional — never crash). */
    @GetMapping
    public List<FlightResponse> board(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String direction) {
        List<Flight> flights;
        if (status != null && !status.isBlank()) {
            flights = flightService.byStatus(status);
        } else if (direction != null && !direction.isBlank()) {
            flights = flightService.byDirection(direction);
        } else {
            flights = flightService.board();
        }
        return flights.stream().map(FlightResponse::from).toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<FlightResponse> get(@PathVariable String id) {
        Flight f = flightService.findById(id);
        return f == null
                ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(FlightResponse.from(f));
    }
}
