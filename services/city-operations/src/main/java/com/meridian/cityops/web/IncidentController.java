package com.meridian.cityops.web;

import com.meridian.cityops.dto.CreateIncidentDto;
import com.meridian.cityops.dto.IncidentResponse;
import com.meridian.cityops.service.IncidentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/incidents")
@RequiredArgsConstructor
@Slf4j
public class IncidentController {

    private final IncidentService incidentService;

    @GetMapping
    public List<IncidentResponse> listActive() {
        return incidentService.listActive();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IncidentResponse createIncident(@RequestBody CreateIncidentDto dto) {
        log.info("POST /api/v1/incidents (manual) assetId={} severity={}",
                dto.getAssetId(), dto.getSeverity());
        return incidentService.createManual(
                dto.getAssetId(),
                dto.getSource(),
                dto.getSeverity(),
                dto.getTitle(),
                dto.getDescription()
        );
    }
}
