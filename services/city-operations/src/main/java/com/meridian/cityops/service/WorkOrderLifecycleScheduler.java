package com.meridian.cityops.service;

import com.meridian.cityops.config.WorkOrderLifecycleProperties;
import com.meridian.cityops.domain.Incident;
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
 * Advances IoT-incident work orders through the simulated business flow on a timer, spacing
 * each step by a realistic randomized delay (see {@link WorkOrderLifecycleProperties}):
 * the deferred incident.created/workorder.created emissions (awaiting_incident ->
 * awaiting_workorder), then created -> assigned -> acknowledged -> resolved. This fills in the
 * iot-incident funnel (which counts incident-linked work orders by status) and resolves the
 * parent incident on completion so the open-incidents list stays bounded.
 *
 * <p>Request-path work orders (status 'created', next_transition_at NULL, incident_id NULL) are
 * never picked up here. {@code completion-probability < 1} intentionally leaves a slice of work
 * orders stuck at acknowledged, producing a realistic funnel drop-off.
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
                List.of("awaiting_incident", "awaiting_workorder", "created", "assigned", "acknowledged"), now);
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
            case "awaiting_incident" -> {
                // Deferred incident.created — look up severity/asset from the incident.
                Incident incident = wo.getIncidentId() == null ? null
                        : incidentRepository.findById(wo.getIncidentId()).orElse(null);
                if (incident != null) {
                    businessEventLogger.incidentCreated(
                            incident.getId(), incident.getAssetId(), incident.getSeverity());
                }
                wo.setStatus("awaiting_workorder");
                wo.setNextTransitionAt(now.plusSeconds(props.nextWorkorderCreatedDelaySeconds()));
                workOrderRepository.save(wo);
            }
            case "awaiting_workorder" -> {
                // Deferred workorder.created, then start the normal lifecycle toward assigned.
                businessEventLogger.workOrderCreated(
                        wo.getId(), wo.getIncidentId(), null, wo.getAssignedDepartment());
                wo.setStatus("created");
                wo.setNextTransitionAt(now.plusSeconds(props.nextAssignedDelaySeconds()));
                workOrderRepository.save(wo);
            }
            case "created" -> {
                wo.setStatus("assigned");
                wo.setAssignedTo("tech-" + ThreadLocalRandom.current().nextInt(100, 1000));
                wo.setAssignedAt(now);
                wo.setNextTransitionAt(now.plusSeconds(props.nextAcknowledgedDelaySeconds()));
                workOrderRepository.save(wo);
                businessEventLogger.workOrderAssigned(wo.getId(), wo.getIncidentId(), wo.getAssignedDepartment());
            }
            case "assigned" -> {
                wo.setStatus("acknowledged");
                wo.setAcknowledgedAt(now);
                wo.setNextTransitionAt(now.plusSeconds(props.nextResolvedDelaySeconds()));
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
}
