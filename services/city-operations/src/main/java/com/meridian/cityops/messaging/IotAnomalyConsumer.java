package com.meridian.cityops.messaging;

import com.meridian.cityops.service.IncidentService;
import com.meridian.cityops.util.BusinessEventLogger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Consumes IoT anomaly events from the iot.anomalies topic and creates
 * corresponding incidents in the system.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IotAnomalyConsumer {

    private final IncidentService incidentService;
    private final BusinessEventLogger businessEventLogger;

    @KafkaListener(
            topics = "iot.anomalies",
            containerFactory = "iotKafkaListenerContainerFactory"
    )
    public void onAnomalyEvent(Map<String, Object> payload) {
        // telemetry-processor publishes snake_case: device_id, anomaly_type, metric_name,
        // value, threshold, severity. (camelCase keys tolerated as a fallback.)
        String assetId = extractString(payload, "device_id",
                extractString(payload, "assetId", "unknown-asset"));
        String anomalyType = extractString(payload, "anomaly_type",
                extractString(payload, "anomalyType", "anomaly"));
        String metricName = extractString(payload, "metric_name", "");
        String severity = mapSeverity(extractString(payload, "severity", "warning"));
        String title = humanTitle(anomalyType, assetId, metricName);

        log.info("Received IoT anomaly event: assetId={}, anomalyType={}, severity={}",
                assetId, anomalyType, severity);

        businessEventLogger.iotAnomalyDetected(assetId, anomalyType);

        incidentService.createFromIot(assetId, severity, title);
    }

    private String extractString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        return val != null ? val.toString() : defaultValue;
    }

    /** Build a readable incident title, e.g. "Engine overtemp on veh-003 (iot.vehicle.engine_temp)". */
    private static String humanTitle(String anomalyType, String assetId, String metricName) {
        String readable = (anomalyType == null || anomalyType.isBlank())
                ? "Anomaly"
                : anomalyType.replace('_', ' ');
        readable = Character.toUpperCase(readable.charAt(0)) + readable.substring(1);
        String base = readable + " on " + assetId;
        return (metricName == null || metricName.isBlank()) ? base : base + " (" + metricName + ")";
    }

    /** Map the publisher's severity onto the incident severity vocabulary. */
    private static String mapSeverity(String raw) {
        return switch (raw == null ? "" : raw.toLowerCase()) {
            case "critical" -> "critical";
            case "high" -> "high";
            case "low" -> "low";
            default -> "medium"; // telemetry-processor emits "warning" -> medium
        };
    }
}
