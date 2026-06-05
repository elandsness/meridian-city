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
    public List<ServiceRequestResponse> findByCitizenId(@RequestParam String citizenId) {
        return serviceRequestService.findByCitizenId(citizenId);
    }

    @PatchMapping("/{id}/status")
    public ServiceRequestResponse updateStatus(@PathVariable String id,
                                               @RequestBody UpdateRequestStatusDto dto) {
        return serviceRequestService.updateStatus(id, dto);
    }
}
