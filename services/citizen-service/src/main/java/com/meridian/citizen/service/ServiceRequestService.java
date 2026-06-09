package com.meridian.citizen.service;

import com.meridian.citizen.domain.ServiceRequest;
import com.meridian.citizen.dto.CreateServiceRequestDto;
import com.meridian.citizen.dto.ServiceRequestResponse;
import com.meridian.citizen.dto.UpdateRequestStatusDto;
import com.meridian.citizen.messaging.RequestEventPublisher;
import com.meridian.citizen.repository.ServiceRequestRepository;
import com.meridian.citizen.util.BusinessEventLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ServiceRequestService {

    private static final Logger log = LoggerFactory.getLogger(ServiceRequestService.class);

    private final ServiceRequestRepository serviceRequestRepository;
    private final BusinessEventLogger businessEventLogger;
    private final DispatchClient dispatchClient;
    private final RequestEventPublisher requestEventPublisher;

    public ServiceRequestService(ServiceRequestRepository serviceRequestRepository,
                                  BusinessEventLogger businessEventLogger,
                                  DispatchClient dispatchClient,
                                  RequestEventPublisher requestEventPublisher) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.businessEventLogger = businessEventLogger;
        this.dispatchClient = dispatchClient;
        this.requestEventPublisher = requestEventPublisher;
    }

    @Transactional
    public ServiceRequestResponse submitRequest(CreateServiceRequestDto dto) {
        // Validate required fields up front. Without this, a null/blank value hits a
        // NOT NULL column constraint and surfaces as a 500 via the catch-all handler;
        // a bad request must map to 400 instead (see docs/API_CONVENTIONS.md §4).
        requireField(dto.citizenId(), "citizen_id");
        requireField(dto.category(), "category");
        requireField(dto.title(), "title");

        // 1. Create and persist the service request
        ServiceRequest request = ServiceRequest.create(
                dto.citizenId(),
                dto.category(),
                dto.title(),
                dto.description(),
                dto.zoneId(),
                dto.priority()
        );
        request = serviceRequestRepository.save(request);

        log.info("Service request submitted: requestId={} citizenId={} category={}",
                request.getId(), request.getCitizenId(), request.getCategory());

        // 2. Emit Business Event: submitted
        businessEventLogger.requestSubmitted(
                request.getId(),
                request.getCitizenId(),
                request.getCategory(),
                request.getPriority(),
                request.getZoneId()
        );

        // 3. Synchronous call to service-dispatch (creates multi-hop distributed trace)
        dispatchClient.dispatchRequest(request);

        // 4. Emit Business Event: validated (after dispatch, regardless of dispatch outcome)
        businessEventLogger.requestValidated(
                request.getId(),
                request.getCitizenId(),
                request.getCategory(),
                request.getPriority()
        );

        // 5. Publish to Kafka
        requestEventPublisher.publishRequestSubmitted(request);

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

    private static void requireField(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }
}
