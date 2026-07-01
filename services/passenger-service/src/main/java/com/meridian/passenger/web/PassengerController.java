package com.meridian.passenger.web;

import com.meridian.passenger.domain.Passenger;
import com.meridian.passenger.dto.PassengerResponse;
import com.meridian.passenger.service.PassengerService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/passengers")
@RequiredArgsConstructor
public class PassengerController {

    private final PassengerService passengerService;

    /** Live passenger journey board. Optional ?status= filter (optional — never crash). */
    @GetMapping
    public List<PassengerResponse> board(@RequestParam(required = false) String status) {
        List<Passenger> passengers = (status != null && !status.isBlank())
                ? passengerService.byStatus(status)
                : passengerService.board();
        return passengers.stream().map(PassengerResponse::from).toList();
    }

    /** The logged-in user's own journey, created on first visit (falls back to a fresh one). */
    @GetMapping("/me")
    public PassengerResponse myJourney(@RequestParam("user_id") String userId,
                                       @RequestParam(value = "name", required = false) String name) {
        return PassengerResponse.from(passengerService.getOrCreateForOwner(userId, name));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PassengerResponse> get(@PathVariable String id) {
        Passenger p = passengerService.findById(id);
        return p == null
                ? ResponseEntity.notFound().build()
                : ResponseEntity.ok(PassengerResponse.from(p));
    }
}
