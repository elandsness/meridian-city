package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityConfigLoader;
import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.config.EntityEngineProperties;
import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.repository.EntityRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * The one background tick every existing hand-written *LifecycleScheduler
 * collapses into: for each entity type this instance owns, top up its
 * population (generator) and advance every due entity (transition +
 * effects + business event). No entity-type-specific code -- entirely driven
 * by {@link EntityConfigLoader}'s parsed {@link EntityDefinition}s.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TransitionScheduler {

    private final EntityConfigLoader configLoader;
    private final EntityEngineService service;
    private final EntityRecordRepository repository;
    private final EntityEngineProperties properties;

    @Scheduled(fixedDelayString = "${entity-engine.scheduler-fixed-delay-ms:5000}")
    public void tick() {
        Map<String, EntityDefinition> owned = configLoader.getOwnedDefinitions();
        if (owned.isEmpty()) return;

        for (Map.Entry<String, EntityDefinition> entry : owned.entrySet()) {
            try {
                runGenerator(entry.getKey(), entry.getValue());
            } catch (RuntimeException ex) {
                log.warn("Generator failed for entityType={}: {}", entry.getKey(), ex.getMessage());
            }
        }

        Set<String> ownedTypes = owned.keySet();
        List<EntityRecord> due = repository.findByEntityTypeInAndNextTransitionAtLessThanEqual(ownedTypes, OffsetDateTime.now());
        for (EntityRecord record : due) {
            try {
                service.advanceIfDue(record.getEntityType(), record);
            } catch (RuntimeException ex) {
                log.warn("Advance failed for id={}: {}", record.getId(), ex.getMessage());
            }
        }
    }

    private void runGenerator(String entityType, EntityDefinition def) {
        EntityDefinition.GeneratorDef gen = def.getGenerator();
        if (gen == null || gen.getStrategy() == null) return;
        switch (gen.getStrategy()) {
            case "simpleSteadyState" -> runSimpleSteadyState(entityType, def, gen);
            case "periodicHistoryBackfill" -> log.debug(
                    "generator strategy \"periodicHistoryBackfill\" is declared but not yet implemented " +
                    "(no Stage 2 flow needs it -- it mirrors billing-service's quarter-backfill shape, a Stage 6 concern) -- skipping for {}",
                    entityType);
            default -> log.warn("Unknown generator strategy \"{}\" for entityType={}", gen.getStrategy(), entityType);
        }
    }

    private void runSimpleSteadyState(String entityType, EntityDefinition def, EntityDefinition.GeneratorDef gen) {
        int maxActive = gen.getMaxActive() != null ? gen.getMaxActive() : 0;
        if (maxActive <= 0) return;

        long active = repository.countByEntityTypeAndStateNotIn(entityType, EntityEngineService.terminalStates(def));
        if (active >= maxActive) return;

        // The scheduler ticks on one fixed global cadence, but each entity type
        // declares its own average spawn interval -- so rather than a per-type
        // timer (which @Scheduled can't express with a runtime-configured value),
        // each tick rolls a probability calibrated so spawns average out to one
        // per `intervalMs` (a Poisson-ish approximation, not exact spacing).
        long intervalMs = gen.getIntervalMs() != null ? gen.getIntervalMs() : properties.getSchedulerFixedDelayMs();
        double spawnProbabilityThisTick = Math.min(1.0, (double) properties.getSchedulerFixedDelayMs() / intervalMs);
        if (ThreadLocalRandom.current().nextDouble() < spawnProbabilityThisTick) {
            service.create(entityType, null);
        }
    }
}
