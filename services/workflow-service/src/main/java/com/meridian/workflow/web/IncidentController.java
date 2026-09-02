package com.meridian.workflow.web;

import com.meridian.workflow.dto.CreateIncidentDto;
import com.meridian.workflow.dto.IncidentResponse;
import com.meridian.workflow.service.IncidentService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/incidents")
public class IncidentController {

    private final IncidentService incidentService;

    public IncidentController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IncidentResponse createIncident(@RequestBody CreateIncidentDto request) {
        return incidentService.createIncident(request);
    }

    @GetMapping("/{id}")
    public IncidentResponse findById(@PathVariable String id) {
        return incidentService.findById(id);
    }

    @GetMapping
    public List<IncidentResponse> listActive() {
        return incidentService.listActive();
    }

    @PatchMapping("/{id}")
    public IncidentResponse updateStatus(@PathVariable String id, @RequestBody java.util.Map<String, String> body) {
        String status = body.get("status");
        if (status == null || status.isBlank()) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "status is required");
        }
        return incidentService.updateStatus(id, status);
    }
}
