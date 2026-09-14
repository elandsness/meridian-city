package com.meridian.journey.web;

import com.meridian.journey.dto.CreateJourneyRequest;\nimport com.meridian.journey.dto.JourneyResponse;\nimport com.meridian.journey.service.JourneyService;\nimport lombok.RequiredArgsConstructor;\nimport org.springframework.http.HttpStatus;\nimport org.springframework.http.ResponseEntity;\nimport org.springframework.web.bind.annotation.GetMapping;\nimport org.springframework.web.bind.annotation.PathVariable;\nimport org.springframework.web.bind.annotation.PostMapping;\nimport org.springframework.web.bind.annotation.RequestBody;\nimport org.springframework.web.bind.annotation.RequestMapping;\nimport org.springframework.web.bind.annotation.RequestParam;\nimport org.springframework.web.bind.annotation.ResponseStatus;\nimport org.springframework.web.bind.annotation.RestController;\n\nimport java.util.List;\nimport java.util.Optional;

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
