package com.meridian.workflow.service;

import com.meridian.workflow.domain.Incident;
import com.meridian.workflow.dto.CreateIncidentDto;
import com.meridian.workflow.dto.IncidentResponse;
import com.meridian.workflow.repository.IncidentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class IncidentService {

    private static final Logger log = LoggerFactory.getLogger(IncidentService.class);

    private final IncidentRepository incidentRepository;

    public IncidentService(IncidentRepository incidentRepository) {
        this.incidentRepository = incidentRepository;
    }

    @Transactional
    public IncidentResponse createIncident(CreateIncidentDto request) {
        requireField(request.title(), "title");

        Incident incident = Incident.create(
                request.assetId(),
                request.source(),
                request.severity(),
                request.title(),
                request.description()
        );

        incident = incidentRepository.save(incident);

        log.info("Incident created: incidentId={} source={}", incident.getId(), incident.getSource());

        return IncidentResponse.from(incident);
    }

    @Transactional(readOnly = true)
    public IncidentResponse findById(String id) {
        return incidentRepository.findById(id)
                .map(IncidentResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Incident not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> listActive() {
        return incidentRepository.findByStatus("open").stream()
                .map(IncidentResponse::from)
                .toList();
    }

    @Transactional
    public IncidentResponse updateStatus(String id, String status) {
        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Incident not found: " + id));

        incident.setStatus(status);

        if ("resolved".equals(status) || "closed".equals(status)) {
            incident.setResolvedAt(OffsetDateTime.now());
        }

        incident = incidentRepository.save(incident);

        log.info("Incident status updated: incidentId={} status={}", incident.getId(), status);

        return IncidentResponse.from(incident);
    }

    private static void requireField(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }
}
