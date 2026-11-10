package com.meridian.journey.web;

import com.meridian.journey.dto.JourneyResponse;
import com.meridian.journey.service.JourneyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/journeys")
public class JourneyController {
    private static final Logger log = LoggerFactory.getLogger(JourneyController.class);
    private final JourneyService journeyService;

    public JourneyController(JourneyService journeyService) {
        this.journeyService = journeyService;
    }

    @GetMapping("/{identityId}")
    public JourneyResponse getJourney(@PathVariable String identityId) {
        log.info("Requesting journey for identity: {}", identityId);
        return journeyService.getJourney(identityId);
    }
}
