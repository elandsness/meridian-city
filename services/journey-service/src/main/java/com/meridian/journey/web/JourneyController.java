package com.meridian.journey.web;

import com.meridian.journey.dto.JourneyResponse;
import com.meridian.journey.service.JourneyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/journeys")
@RequiredArgsConstructor
public class JourneyController {

    private final JourneyService journeyService;

    /** Live journey board. Optional ?entity_type=, ?status=, or ?direction= filters. */
    @GetMapping
    public List<JourneyResponse> board(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String direction) {
        return journeyService.board(entityType, status, direction);
    }

    @GetMapping("/{id}")
    public ResponseEntity<JourneyResponse> get(@PathVariable String id) {
        JourneyResponse journey = journeyService.get(id);
        return ResponseEntity.ok(journey);
    }
}
