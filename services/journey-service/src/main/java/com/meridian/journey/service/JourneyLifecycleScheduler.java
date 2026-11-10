package com.meridian.journey.service;

import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.dto.Journey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Map;

@Service
public class JourneyLifecycleScheduler {
    private static final Logger log = LoggerFactory.getLogger(JourneyLifecycleScheduler.class);
    
    private final JourneyService journeyService;
    private final JourneyLifecycleProperties props;

    public JourneyLifecycleScheduler(JourneyService journeyService, JourneyLifecycleProperties props) {
        this.journeyService = journeyService;
        this.props = props;
    }

    @Scheduled(fixedDelay = 10000)
    public void tick() {
        if (!props.isEnabled()) return;
        
        Map<String, Journey> journeys = journeyService.getActiveJourneys();
        log.debug("Ticking journeys. Active count: {}", journeys.size());

        journeys.forEach((id, journey) -> {
            String currentStatus = journey.getStatus();
            String nextStatus = props.getNextStatus(currentStatus);
            
            if (nextStatus != null) {
                double progress = props.progressFor(nextStatus);
                journey.setProgress(progress);
                journey.setStatus(nextStatus);
                journey.setUpdatedAt(OffsetDateTime.now());
                log.info("Journey {} transitioned: {} -> {}", id, currentStatus, nextStatus);
            } else {
                journeyService.endJourney(id);
            }
        });
    }
}