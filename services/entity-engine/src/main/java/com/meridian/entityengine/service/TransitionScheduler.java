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
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

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

    private static final String AMOUNT_FIELD = "amount_cents";
    private static final String ISSUED_AT_FIELD = "issued_at";
    private static final String DUE_AT_FIELD = "due_at";
    private static final String PAID_AT_FIELD = "paid_at";

    private final EntityConfigLoader configLoader;
    private final EntityEngineService service;
    private final EntityRecordRepository repository;
    private final EntityEngineProperties properties;
    private final EntityFactory entityFactory;

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
            case "periodicHistoryBackfill" -> runPeriodicHistoryBackfill(entityType, def, gen);
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

    /**
     * Generalizes billing-service's two tax-bill generators (a one-time,
     * per-citizen quarter backfill at registration + an hourly current-quarter
     * issuance for every known citizen) into one strategy: every tick, every
     * `ownerEntityType` instance either gets a brand-new multi-quarter
     * backfill (if it has none of this entity type yet) or gets topped up with
     * exactly one new record for the current period (if it's missing one).
     * Requires the entity type to declare number fields named amount_cents,
     * issued_at, due_at, paid_at (a fixed convention for this strategy, the
     * same way computed.position requires specific waypoint state keys).
     */
    private void runPeriodicHistoryBackfill(String entityType, EntityDefinition def, EntityDefinition.GeneratorDef gen) {
        EntityDefinition.BackfillDef backfill = gen.getBackfill();
        EntityDefinition.AmountRangeDef amount = gen.getAmount();
        if (gen.getOwnerEntityType() == null || gen.getOwnerField() == null || backfill == null || amount == null) {
            log.warn("periodicHistoryBackfill generator for {} is missing ownerEntityType/ownerField/backfill/amount config -- skipping.", entityType);
            return;
        }
        String periodField = gen.getPeriodField() != null ? gen.getPeriodField() : "period";
        int dueDays = gen.getDueDays() != null ? gen.getDueDays() : 45;
        String currentPeriod = quarterPeriod(OffsetDateTime.now());

        List<EntityRecord> owners = repository.findByEntityType(gen.getOwnerEntityType());
        Map<String, List<EntityRecord>> existingByOwner = repository.findByEntityType(entityType).stream()
                .collect(Collectors.groupingBy(r -> String.valueOf(r.getField(gen.getOwnerField()))));

        for (EntityRecord owner : owners) {
            List<EntityRecord> existing = existingByOwner.getOrDefault(owner.getId(), List.of());
            if (existing.isEmpty()) {
                backfillHistory(entityType, def, gen, owner, periodField, dueDays, amount, backfill, currentPeriod);
            } else {
                boolean hasCurrentPeriod = existing.stream().anyMatch(r -> currentPeriod.equals(r.getField(periodField)));
                if (!hasCurrentPeriod) {
                    issueOutstanding(entityType, def, gen, owner, periodField, dueDays, amount, currentPeriod);
                }
            }
        }
    }

    private void backfillHistory(String entityType, EntityDefinition def, EntityDefinition.GeneratorDef gen, EntityRecord owner,
                                  String periodField, int dueDays, EntityDefinition.AmountRangeDef amount,
                                  EntityDefinition.BackfillDef backfill, String currentPeriod) {
        int periods = backfill.getMinPeriods() + ThreadLocalRandom.current().nextInt(backfill.getMaxPeriods() - backfill.getMinPeriods() + 1);
        int outstandingCount = backfill.getOutstandingMin() + ThreadLocalRandom.current().nextInt(backfill.getOutstandingMax() - backfill.getOutstandingMin() + 1);
        String period = currentPeriod;
        for (int i = 0; i < periods; i++) {
            boolean outstanding = i < outstandingCount;
            if (outstanding) {
                issueOutstanding(entityType, def, gen, owner, periodField, dueDays, amount, period);
            } else {
                // Paid history is seeded silently, matching legacy behavior -- no business
                // event fires for it, only the outstanding bills (below) are "issued".
                seedPaidHistory(entityType, def, gen, owner, periodField, dueDays, amount, period);
            }
            period = quarterPeriodMinus(period, 1);
        }
    }

    private void issueOutstanding(String entityType, EntityDefinition def, EntityDefinition.GeneratorDef gen, EntityRecord owner,
                                   String periodField, int dueDays, EntityDefinition.AmountRangeDef amount, String period) {
        OffsetDateTime issuedAt = quarterStart(period);
        Map<String, Object> fields = baseFields(gen, owner, periodField, period, amount, issuedAt, dueDays);
        EntityRecord record = entityFactory.build(def, entityType, fields); // state = def.getInitial() (the "outstanding"-equivalent state)
        entityFactory.scheduleNext(record, def);
        repository.save(record);
        entityFactory.recordCreation(record, def);
    }

    private void seedPaidHistory(String entityType, EntityDefinition def, EntityDefinition.GeneratorDef gen, EntityRecord owner,
                                  String periodField, int dueDays, EntityDefinition.AmountRangeDef amount, String period) {
        OffsetDateTime issuedAt = quarterStart(period);
        OffsetDateTime dueAt = issuedAt.plusDays(dueDays);
        OffsetDateTime paidAt = dueAt.minusDays(5);
        Map<String, Object> fields = baseFields(gen, owner, periodField, period, amount, issuedAt, dueDays);
        fields.put(PAID_AT_FIELD, paidAt.toString());

        EntityRecord record = entityFactory.build(def, entityType, fields);
        String paidState = def.getStates().entrySet().stream()
                .filter(e -> e.getValue().isTerminal() && !e.getValue().isError())
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(def.getInitial());
        record.setState(paidState);
        record.setNextTransitionAt(null);
        repository.save(record); // silent seed -- no recordCreation() call, matching legacy's un-eventful paid-history backfill
    }

    private Map<String, Object> baseFields(EntityDefinition.GeneratorDef gen, EntityRecord owner, String periodField, String period,
                                            EntityDefinition.AmountRangeDef amount, OffsetDateTime issuedAt, int dueDays) {
        long amountCents = amount.getMinCents() + Math.round(ThreadLocalRandom.current().nextDouble() * (amount.getMaxCents() - amount.getMinCents()));
        Map<String, Object> fields = new HashMap<>();
        fields.put(gen.getOwnerField(), owner.getId());
        fields.put(periodField, period);
        fields.put(AMOUNT_FIELD, amountCents);
        fields.put(ISSUED_AT_FIELD, issuedAt.toString());
        fields.put(DUE_AT_FIELD, issuedAt.plusDays(dueDays).toString());
        return fields;
    }

    static String quarterPeriod(OffsetDateTime t) {
        int quarter = (t.getMonthValue() - 1) / 3 + 1;
        return t.getYear() + "-Q" + quarter;
    }

    static String quarterPeriodMinus(String period, int quartersBack) {
        String[] parts = period.split("-Q");
        int year = Integer.parseInt(parts[0]);
        int quarter = Integer.parseInt(parts[1]);
        int index = (year * 4 + (quarter - 1)) - quartersBack;
        return (index / 4) + "-Q" + (index % 4 + 1);
    }

    static OffsetDateTime quarterStart(String period) {
        String[] parts = period.split("-Q");
        int year = Integer.parseInt(parts[0]);
        int quarter = Integer.parseInt(parts[1]);
        int startMonth = (quarter - 1) * 3 + 1;
        return YearMonth.of(year, startMonth).atDay(1).atStartOfDay().atOffset(OffsetDateTime.now().getOffset());
    }
}
