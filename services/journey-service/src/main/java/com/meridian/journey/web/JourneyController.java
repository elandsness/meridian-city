package com.meridian.journey.web;

import com.meridian.journey.dto.CreateJourneyRequest;
import com.meridian.journey.dto.JourneyResponse;
import com.meridian.journey.service.JourneyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
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

    /** Creates a journey externally (traffic-bot, seed scripts) — e.g. a freight
     * delivery with real map coordinates. Journeys created this way are advanced
     * by the same JourneyLifecycleScheduler as generator-created ones. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JourneyResponse create(@RequestBody CreateJourneyRequest request) {
        return journeyService.createFromRequest(request);
    }
}
