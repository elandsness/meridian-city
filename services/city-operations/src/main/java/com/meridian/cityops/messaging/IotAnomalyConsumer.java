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
        String assetId = extractString(payload, "assetId", "unknown-asset");
        String anomalyType = extractString(payload, "anomalyType", "unknown");
        String severity = extractString(payload, "severity", "medium");
        String title = extractString(payload, "title",
                "IoT anomaly detected: " + anomalyType + " on " + assetId);

        log.info("Received IoT anomaly event: assetId={}, anomalyType={}, severity={}",
                assetId, anomalyType, severity);

        businessEventLogger.iotAnomalyDetected(assetId, anomalyType);

        incidentService.createFromIot(assetId, severity, title);
    }

    private String extractString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        return val != null ? val.toString() : defaultValue;
    }
}
