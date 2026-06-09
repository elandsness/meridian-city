package com.meridian.citizen.web;

import com.meridian.citizen.dto.CreateServiceRequestDto;
import com.meridian.citizen.dto.ServiceRequestResponse;
import com.meridian.citizen.dto.UpdateRequestStatusDto;
import com.meridian.citizen.service.ServiceRequestService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/service-requests")
public class ServiceRequestController {

    private final ServiceRequestService serviceRequestService;

    public ServiceRequestController(ServiceRequestService serviceRequestService) {
        this.serviceRequestService = serviceRequestService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceRequestResponse submitRequest(@RequestBody CreateServiceRequestDto dto) {
        return serviceRequestService.submitRequest(dto);
    }

    @GetMapping("/{id}")
    public ServiceRequestResponse findById(@PathVariable String id) {
        return serviceRequestService.findById(id);
    }

    @GetMapping
    public List<ServiceRequestResponse> list(
            @RequestParam(name = "citizen_id", required = false) String citizenId,
            @RequestParam(name = "limit", required = false, defaultValue = "50") int limit) {
        // citizen_id is optional: when absent we return the most recent requests
        // across all citizens (the public portal's list view). page is accepted
        // by the client but ignored here — limit alone is sufficient for the demo.
        return serviceRequestService.list(citizenId, limit);
    }

    @PatchMapping("/{id}/status")
    public ServiceRequestResponse updateStatus(@PathVariable String id,
                                               @RequestBody UpdateRequestStatusDto dto) {
        return serviceRequestService.updateStatus(id, dto);
    }
}
