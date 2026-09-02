package com.meridian.workflow.service;

import com.meridian.workflow.domain.ServiceRequest;
import com.meridian.workflow.dto.CreateServiceRequestDto;
import com.meridian.workflow.dto.ServiceRequestResponse;
import com.meridian.workflow.repository.ServiceRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class WorkflowService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowService.class);

    private final ServiceRequestRepository serviceRequestRepository;

    public WorkflowService(ServiceRequestRepository serviceRequestRepository) {
        this.serviceRequestRepository = serviceRequestRepository;
    }

    @Transactional
    public ServiceRequestResponse createServiceRequest(CreateServiceRequestDto request) {
        // Validate required fields
        requireField(request.title(), "title");
        requireField(request.category(), "category");

        ServiceRequest serviceRequest = ServiceRequest.create(
                request.citizenId(),
                request.category(),
                request.priority(),
                request.title(),
                request.description(),
                request.zoneId()
        );

        serviceRequest = serviceRequestRepository.save(serviceRequest);

        log.info("Service request created: requestId={} citizenId={}", serviceRequest.getId(), serviceRequest.getCitizenId());

        return ServiceRequestResponse.from(serviceRequest);
    }

    @Transactional(readOnly = true)
    public ServiceRequestResponse findById(String id) {
        return serviceRequestRepository.findById(id)
                .map(ServiceRequestResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Service request not found: " + id));
    }

    @Transactional(readOnly = true)
    public java.util.List<ServiceRequestResponse> listByStatus(String status) {
        return serviceRequestRepository.findByStatus(status).stream()
                .map(ServiceRequestResponse::from)
                .toList();
    }

    private static void requireField(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }
}
