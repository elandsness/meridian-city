package com.meridian.cityops.service;

import com.meridian.cityops.domain.Incident;
import com.meridian.cityops.dto.IncidentResponse;
import com.meridian.cityops.repository.IncidentRepository;
import com.meridian.cityops.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final BusinessEventLogger businessEventLogger;

    @Transactional(readOnly = true)
    public List<IncidentResponse> listActive() {
        // Return all incidents that have not been resolved
        return incidentRepository.findAll().stream()
                .filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IncidentResponse createFromIot(String assetId, String severity, String title) {
        Incident incident = Incident.create(assetId, "iot", severity, title, null);
        incident = incidentRepository.save(incident);
        log.info("Created incident id={} from IoT anomaly on assetId={}", incident.getId(), assetId);
        businessEventLogger.incidentCreated(incident.getId(), assetId, severity);
        return toResponse(incident);
    }

    @Transactional
    public IncidentResponse createManual(String assetId, String source, String severity,
                                          String title, String description) {
        Incident incident = Incident.create(assetId, source, severity, title, description);
        incident = incidentRepository.save(incident);
        log.info("Created manual incident id={} title='{}'", incident.getId(), title);
        businessEventLogger.incidentCreated(incident.getId(), assetId, severity);
        return toResponse(incident);
    }

    // -------------------------------------------------------------------------

    private IncidentResponse toResponse(Incident incident) {
        return IncidentResponse.builder()
                .id(incident.getId())
                .assetId(incident.getAssetId())
                .severity(incident.getSeverity())
                .status(incident.getStatus())
                .title(incident.getTitle())
                .createdAt(incident.getCreatedAt())
                .build();
    }
}
