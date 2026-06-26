package com.meridian.cityops.service;

import com.meridian.cityops.config.WorkOrderLifecycleProperties;
import com.meridian.cityops.domain.WorkOrder;
import com.meridian.cityops.repository.IncidentRepository;
import com.meridian.cityops.repository.WorkOrderRepository;
import com.meridian.cityops.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Advances work orders through the simulated lifecycle on a timer:
 * created -> assigned -> acknowledged -> resolved. This fills in the iot-incident
 * Business Analytics funnel (which counts incident-linked work orders by status) and
 * resolves the parent incident on completion so the open-incidents list stays bounded.
 *
 * <p>{@code completion-probability < 1} intentionally leaves a slice of work orders
 * stuck at acknowledged, producing a realistic funnel drop-off to investigate.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class WorkOrderLifecycleScheduler {

    private final WorkOrderRepository workOrderRepository;
    private final IncidentRepository incidentRepository;
    private final BusinessEventLogger businessEventLogger;
    private final WorkOrderLifecycleProperties props;

    @Scheduled(fixedDelay = 10_000)
    @Transactional
    public void advanceWorkOrders() {
        if (!props.isEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        List<WorkOrder> due = workOrderRepository.findByStatusInAndNextTransitionAtLessThanEqual(
                List.of("created", "assigned", "acknowledged"), now);
        for (WorkOrder wo : due) {
            try {
                advance(wo, now);
            } catch (RuntimeException ex) {
                log.warn("Work-order advance failed for id={}: {}", wo.getId(), ex.getMessage());
            }
        }
    }

    private void advance(WorkOrder wo, OffsetDateTime now) {
        switch (wo.getStatus()) {
            case "created" -> {
                wo.setStatus("assigned");
                wo.setAssignedTo("tech-" + ThreadLocalRandom.current().nextInt(100, 1000));
                wo.setAssignedAt(now);
                wo.setNextTransitionAt(now.plusSeconds(jitter(props.getAcknowledgedAfterSeconds())));
                workOrderRepository.save(wo);
                businessEventLogger.workOrderAssigned(wo.getId(), wo.getIncidentId(), wo.getAssignedDepartment());
            }
            case "assigned" -> {
                wo.setStatus("acknowledged");
                wo.setAcknowledgedAt(now);
                wo.setNextTransitionAt(now.plusSeconds(jitter(props.getResolvedAfterSeconds())));
                workOrderRepository.save(wo);
                businessEventLogger.workOrderAcknowledged(wo.getId(), wo.getIncidentId());
            }
            case "acknowledged" -> {
                if (ThreadLocalRandom.current().nextDouble() <= props.getCompletionProbability()) {
                    wo.setStatus("resolved");
                    wo.setResolvedAt(now);
                    wo.setNextTransitionAt(null);
                    workOrderRepository.save(wo);
                    businessEventLogger.workOrderResolved(wo.getId(), wo.getIncidentId());
                    resolveIncident(wo.getIncidentId(), now);
                } else {
                    // Leave acknowledged but never resolved (funnel drop-off).
                    wo.setNextTransitionAt(null);
                    workOrderRepository.save(wo);
                }
            }
            default -> { /* terminal or unknown status — nothing to do */ }
        }
    }

    private void resolveIncident(String incidentId, OffsetDateTime now) {
        if (incidentId == null) {
            return;
        }
        incidentRepository.findById(incidentId).ifPresent(incident -> {
            if (!"resolved".equalsIgnoreCase(incident.getStatus())) {
                incident.setStatus("resolved");
                incident.setResolvedAt(now);
                incidentRepository.save(incident);
                businessEventLogger.incidentResolved(incident.getId(), incident.getSeverity());
            }
        });
    }

    /** ±20% jitter so transitions don't all fire on the same tick. */
    private long jitter(long base) {
        double factor = 0.8 + ThreadLocalRandom.current().nextDouble() * 0.4;
        return Math.max(1L, Math.round(base * factor));
    }
}
