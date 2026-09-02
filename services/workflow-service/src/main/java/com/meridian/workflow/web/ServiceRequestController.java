package com.meridian.workflow.web;

import com.meridian.workflow.dto.CreateServiceRequestDto;
import com.meridian.workflow.dto.ServiceRequestResponse;
import com.meridian.workflow.service.WorkflowService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/service-requests")
public class ServiceRequestController {

    private final WorkflowService workflowService;

    public ServiceRequestController(WorkflowService workflowService) {
        this.workflowService = workflowService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceRequestResponse createServiceRequest(@RequestBody CreateServiceRequestDto request) {
        return workflowService.createServiceRequest(request);
    }

    @GetMapping("/{id}")
    public ServiceRequestResponse findById(@PathVariable String id) {
        return workflowService.findById(id);
    }

    @GetMapping
    public List<ServiceRequestResponse> listByStatus(@RequestParam(required = false) String status) {
        if (status != null && !status.isBlank()) {
            return workflowService.listByStatus(status);
        }
        // Return all by default
        return List.of();
    }
}
