package com.meridian.journey.service;

import com.meridian.journey.config.JourneyGeneratorProperties;
import com.meridian.journey.config.JourneyLifecycleProperties;
import com.meridian.journey.domain.Journey;
import com.meridian.journey.repository.JourneyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Generates new journeys on a timer to keep the data feeling real in a long-running lab.
 * Creates journeys of configured entity types (e.g., "flight", "passenger") with random
 * metadata (origin, destination, etc.).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JourneyGenerator {

    private final JourneyRepository journeyRepository;
    private final JourneyGeneratorProperties props;
    private final JourneyLifecycleProperties lifecycleProps;

    @Scheduled(fixedDelay = 5_000, initialDelay = 10_000)
    @Transactional
    public void generateJourneys() {
        if (!props.isEnabled()) {
            return;
        }

        long activeCount = journeyRepository.count();
        if (activeCount >= props.getMaxActive()) {
            return;
        }

        // Generate a new journey
        String entityType = props.getEntityTypes()[ThreadLocalRandom.current().nextInt(props.getEntityTypes().length)];
        Journey journey = createRandomJourney(entityType);
        // Without this, JourneyLifecycleScheduler's next_transition_at <= now query
        // never matches a NULL (unknown in SQL) and the journey never advances.
        journey.setNextTransitionAt(OffsetDateTime.now().plusSeconds(lifecycleProps.nextDelaySeconds()));
        journeyRepository.save(journey);

        log.debug("Generated {} journey id={}", entityType, journey.getId());
    }

    private Journey createRandomJourney(String entityType) {
        OffsetDateTime now = OffsetDateTime.now();
        String initialStatus = props.getInitialStatuses().getOrDefault(entityType, "initiated");

        return switch (entityType) {
            case "flight" -> Journey.create(
                    "flight",
                    "FLT" + String.format("%04d", ThreadLocalRandom.current().nextInt(1000, 9999)),
                    null,
                    ThreadLocalRandom.current().nextBoolean() ? "departure" : "arrival",
                    randomAirport(),
                    randomAirport(),
                    null,
                    initialStatus
            );
            case "passenger" -> Journey.create(
                    "passenger",
                    "PAS" + String.format("%04d", ThreadLocalRandom.current().nextInt(1000, 9999)),
                    null,
                    "departure",
                    null,
                    null,
                    String.format("{\"hasBag\":%s}", ThreadLocalRandom.current().nextDouble() < props.getBagProbability()),
                    initialStatus
            );
            default -> createFromRoute(entityType, initialStatus);
        };
    }

    /** Any entity type not hardcoded above (e.g. "truck") — picks a random
     * configured route so the map has something to show. No routes configured
     * -> same as before (no coordinates, renders in lists but not on a map). */
    private Journey createFromRoute(String entityType, String initialStatus) {
        String name = entityType + "-" + ThreadLocalRandom.current().nextInt(10000);
        List<JourneyGeneratorProperties.RouteConfig> routes = props.getRoutes();
        if (routes == null || routes.isEmpty()) {
            return Journey.create(entityType, name, null, null, null, null, null, initialStatus);
        }
        JourneyGeneratorProperties.RouteConfig route = routes.get(ThreadLocalRandom.current().nextInt(routes.size()));
        return Journey.create(entityType, name, null, null, route.getOrigin(), route.getDestination(), null,
                initialStatus, route.getOriginX(), route.getOriginY(), route.getDestX(), route.getDestY());
    }

    private String randomAirport() {
        String[] airports = {"JFK", "LAX", "ORD", "LHR", "CDG", "NRT", "DXB", "SIN"};
        return airports[ThreadLocalRandom.current().nextInt(airports.length)];
    }
}
