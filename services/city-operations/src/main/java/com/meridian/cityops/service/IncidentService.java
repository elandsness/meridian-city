package com.meridian.cityops.service;

import com.meridian.cityops.domain.CityAsset;
import com.meridian.cityops.domain.Incident;
import com.meridian.cityops.domain.WorkOrder;
import com.meridian.cityops.domain.Zone;
import com.meridian.cityops.dto.IncidentResponse;
import com.meridian.cityops.repository.CityAssetRepository;
import com.meridian.cityops.repository.IncidentRepository;
import com.meridian.cityops.repository.WorkOrderRepository;
import com.meridian.cityops.repository.ZoneRepository;
import com.meridian.cityops.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final CityAssetRepository cityAssetRepository;
    private final ZoneRepository zoneRepository;
    private final WorkOrderRepository workOrderRepository;
    private final BusinessEventLogger businessEventLogger;

    /**
     * Stubbed map coordinates per seeded zone. The schema has no real geo data
     * (city.zones.geojson is empty and city.assets has no lat/lng), so until a
     * geocoding source exists we cluster incidents onto their zone near the base
     * map's center (~[51.505, -0.09], London) so the public-portal map renders
     * pins. See docs/API_CONVENTIONS.md finding #9. Zones without an entry here
     * (or incidents whose asset can't be resolved to a zone) get a null location
     * and simply don't appear on the map.
     */
    private static final Map<String, double[]> ZONE_COORDINATES = Map.of(
            "zone-north",   new double[]{51.516, -0.090},
            "zone-south",   new double[]{51.495, -0.090},
            "zone-east",    new double[]{51.508, -0.072},
            "zone-west",    new double[]{51.506, -0.110},
            "zone-central", new double[]{51.505, -0.090}
    );

    @Transactional(readOnly = true)
    public List<IncidentResponse> listActive() {
        // All incidents that have not been resolved.
        List<Incident> incidents = incidentRepository.findAll().stream()
                .filter(i -> !"resolved".equalsIgnoreCase(i.getStatus()))
                .toList();
        if (incidents.isEmpty()) {
            return List.of();
        }

        // Resolve each incident's asset -> zone (for coordinate + zone name), and
        // count work orders per incident, with batched queries to avoid N+1s.
        Set<String> assetIds = incidents.stream()
                .map(Incident::getAssetId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, String> assetToZone = cityAssetRepository.findAllById(assetIds).stream()
                .filter(a -> a.getZoneId() != null)
                .collect(Collectors.toMap(CityAsset::getId, CityAsset::getZoneId));

        Map<String, String> zoneNames = zoneRepository.findAllById(assetToZone.values()).stream()
                .collect(Collectors.toMap(Zone::getId, Zone::getName));

        Set<String> incidentIds = incidents.stream().map(Incident::getId).collect(Collectors.toSet());
        Map<String, Long> workOrderCounts = workOrderRepository.findByIncidentIdIn(incidentIds).stream()
                .filter(w -> w.getIncidentId() != null)
                .collect(Collectors.groupingBy(WorkOrder::getIncidentId, Collectors.counting()));

        return incidents.stream()
                .map(inc -> {
                    String zoneId = assetToZone.get(inc.getAssetId());
                    return toResponse(
                            inc,
                            zoneId,
                            zoneId != null ? zoneNames.get(zoneId) : null,
                            workOrderCounts.getOrDefault(inc.getId(), 0L)
                    );
                })
                .toList();
    }

    @Transactional
    public IncidentResponse createFromIot(String assetId, String severity, String title) {
        Incident incident = Incident.create(assetId, "iot", severity, title, null);
        incident = incidentRepository.save(incident);
        log.info("Created incident id={} from IoT anomaly on assetId={}", incident.getId(), assetId);
        businessEventLogger.incidentCreated(incident.getId(), assetId, severity);
        return enrich(incident);
    }

    @Transactional
    public IncidentResponse createManual(String assetId, String source, String severity,
                                          String title, String description) {
        Incident incident = Incident.create(assetId, source, severity, title, description);
        incident = incidentRepository.save(incident);
        log.info("Created manual incident id={} title='{}'", incident.getId(), title);
        businessEventLogger.incidentCreated(incident.getId(), assetId, severity);
        return enrich(incident);
    }

    // -------------------------------------------------------------------------

    /** Enrich a single, freshly created incident with its zone-derived fields. */
    private IncidentResponse enrich(Incident incident) {
        String zoneId = incident.getAssetId() == null ? null
                : cityAssetRepository.findById(incident.getAssetId())
                        .map(CityAsset::getZoneId)
                        .orElse(null);
        String zoneName = zoneId == null ? null
                : zoneRepository.findById(zoneId).map(Zone::getName).orElse(null);
        // A just-created incident has no work orders yet; listActive() does the real count.
        return toResponse(incident, zoneId, zoneName, 0L);
    }

    private IncidentResponse toResponse(Incident incident, String zoneId, String zoneName,
                                        long workOrderCount) {
        return IncidentResponse.builder()
                .id(incident.getId())
                .assetId(incident.getAssetId())
                .severity(incident.getSeverity())
                .status(incident.getStatus())
                .title(incident.getTitle())
                .description(incident.getDescription())
                .locationName(zoneName)
                .location(locationForZone(zoneId))
                .workOrderCount(workOrderCount)
                .createdAt(incident.getCreatedAt())
                .resolvedAt(incident.getResolvedAt())
                .build();
    }

    private IncidentResponse.Location locationForZone(String zoneId) {
        if (zoneId == null) {
            return null;
        }
        double[] coords = ZONE_COORDINATES.get(zoneId);
        if (coords == null) {
            return null;
        }
        return new IncidentResponse.Location(coords[0], coords[1]);
    }
}
