package com.meridian.citizen.service;

import com.meridian.citizen.config.FaultState;
import com.meridian.citizen.config.RequestLifecycleProperties;
import com.meridian.citizen.domain.RequestEvent;
import com.meridian.citizen.domain.ServiceRequest;
import com.meridian.citizen.dto.CreateServiceRequestDto;
import com.meridian.citizen.dto.ServiceRequestResponse;
import com.meridian.citizen.dto.UpdateRequestStatusDto;
import com.meridian.citizen.messaging.RequestEventPublisher;
import com.meridian.citizen.repository.RequestEventRepository;
import com.meridian.citizen.repository.ServiceRequestRepository;
import com.meridian.citizen.util.BusinessEventLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class ServiceRequestService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestService.class);

    private final ServiceRequestRepository serviceRequestRepository;
    private final RequestEventRepository requestEventRepository;
    private final BusinessEventLogger businessEventLogger;
    private final DispatchClient dispatchClient;
    private final RequestEventPublisher requestEventPublisher;
    private final FaultState faultState;
    private final RequestLifecycleProperties lifecycleProps;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository,
                                  RequestEventRepository requestEventRepository,
                                  BusinessEventLogger businessEventLogger,
                                  DispatchClient dispatchClient,
                                  RequestEventPublisher requestEventPublisher,
                                  FaultState faultState,
                                  RequestLifecycleProperties lifecycleProps) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.requestEventRepository = requestEventRepository;
        this.businessEventLogger = businessEventLogger;
        this.dispatchClient = dispatchClient;
        this.requestEventPublisher = requestEventPublisher;
        this.faultState = faultState;
        this.lifecycleProps = lifecycleProps;
    }

    @Transactional
    public ServiceRequestResponse submitRequest(CreateServiceRequestDto dto) {
        // Validate required fields up front. Without this, a null/blank value hits a
        // NOT NULL column constraint and surfaces as a 500 via the catch-all handler;
        // a bad request must map to 400 instead (see docs/API_CONVENTIONS.md §4).
        requireField(dto.citizenId(), "citizen_id");
        requireField(dto.category(), "category");
        requireField(dto.title(), "title");

        // 1. Create and persist the service request.
        // Apply the db-slowdown fault (if enabled) right before the write so the
        // latency is attributed to the DB operation in the distributed trace.
        ServiceRequest request = ServiceRequest.create(
                dto.citizenId(),
                dto.category(),
                dto.title(),
                dto.description(),
                dto.zoneId(),
                dto.priority()
        );
        // Schedule the first lifecycle transition (submitted -> in_progress); the
        // RequestLifecycleScheduler advances it from here. Null when disabled.
        if (lifecycleProps.isEnabled()) {
            request.setNextTransitionAt(
                    OffsetDateTime.now().plusSeconds(lifecycleProps.getInProgressAfterSeconds()));
        }

        faultState.maybeDelay();
        // saveAndFlush so the request row exists before the request_events FK insert below.
        request = serviceRequestRepository.saveAndFlush(request);

        log.info("Service request submitted: requestId={} citizenId={} category={}",
                request.getId(), request.getCitizenId(), request.getCategory());

        // 2. Emit Business Event: submitted — both a JSON log (for Dynatrace) and a
        //    request_events row (powers the ops-dashboard Business Analytics funnel).
        businessEventLogger.requestSubmitted(
                request.getId(),
                request.getCitizenId(),
                request.getCategory(),
                request.getPriority(),
                request.getZoneId()
        );
        recordEvent(request.getId(), "service_request.submitted");

        // 3. Emit Business Event: validated.
        businessEventLogger.requestValidated(
                request.getId(),
                request.getCitizenId(),
                request.getCategory(),
                request.getPriority()
        );
        recordEvent(request.getId(), "service_request.validated");

        // 4. Publish to Kafka
        requestEventPublisher.publishRequestSubmitted(request);

        // 5. Dispatch to service-dispatch — but only AFTER this transaction commits.
        //    service-dispatch records request_events rows with an FK to service_requests
        //    on a separate DB connection, so the service_request must be committed and
        //    visible first. Calling it mid-transaction makes every dispatch 500 on the FK
        //    (the real cause of dispatched/assigned never being recorded). Running in
        //    afterCommit keeps the call on the request thread, preserving the
        //    api-gateway -> citizen-service -> service-dispatch distributed trace.
        final ServiceRequest dispatchTarget = request;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    dispatchClient.dispatchRequest(dispatchTarget);
                }
            });
        } else {
            dispatchClient.dispatchRequest(request);
        }

        return ServiceRequestResponse.from(request);
    }

    @Transactional
    public ServiceRequestResponse updateStatus(String id, UpdateRequestStatusDto dto) {
        ServiceRequest request = serviceRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Service request not found: " + id));

        String previousStatus = request.getStatus();
        request.setStatus(dto.status());

        if (dto.assignedDepartment() != null) {
            request.setAssignedDepartment(dto.assignedDepartment());
        }
        if (dto.assignedTo() != null) {
            request.setAssignedTo(dto.assignedTo());
        }

        request = serviceRequestRepository.save(request);

        businessEventLogger.requestStatusUpdated(
                request.getId(),
                request.getCitizenId(),
                previousStatus,
                request.getStatus(),
                request.getAssignedDepartment()
        );
        // Per-status lifecycle event (e.g. service_request.in_progress,
        // service_request.resolved) for the Business Analytics funnel.
        recordEvent(request.getId(), "service_request." + request.getStatus());

        // Publish the status change to Kafka so the per-citizen notification inbox
        // can surface it (notification-service keys off service_request.resolved, etc.).
        requestEventPublisher.publishRequestStatusChanged(request);

        return ServiceRequestResponse.from(request);
    }

    @Transactional(readOnly = true)
    public ServiceRequestResponse findById(String id) {
        return serviceRequestRepository.findById(id)
                .map(ServiceRequestResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Service request not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<ServiceRequestResponse> list(String citizenId, int limit) {
        int capped = Math.min(Math.max(limit, 1), 200);
        List<ServiceRequest> results;
        if (citizenId != null && !citizenId.isBlank()) {
            results = serviceRequestRepository.findByCitizenIdOrderByCreatedAtDesc(citizenId);
            if (results.size() > capped) {
                results = results.subList(0, capped);
            }
        } else {
            results = serviceRequestRepository
                    .findAll(PageRequest.of(0, capped, Sort.by(Sort.Direction.DESC, "createdAt")))
                    .getContent();
        }
        return results.stream().map(ServiceRequestResponse::from).toList();
    }

    /** Persist a request lifecycle event for the Business Analytics funnel. */
    private void recordEvent(String requestId, String eventType) {
        requestEventRepository.save(RequestEvent.of(requestId, eventType));
    }

    private static void requireField(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }
}
