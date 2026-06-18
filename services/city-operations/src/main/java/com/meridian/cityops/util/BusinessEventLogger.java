package com.meridian.cityops.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits structured Business Events that Dynatrace extracts from the log stream.
 * All events use "event.type" as the discriminator key — this matches the Dynatrace
 * Business Events log processing rule configured in dynatrace-config-guide.md.
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void workOrderCreated(String workOrderId, String requestId, String assignedDepartment) {
        BUSINESS_EVENTS.info("workorder.created",
                StructuredArguments.keyValue("event.type", "workorder.created"),
                StructuredArguments.keyValue("work_order.id", workOrderId),
                StructuredArguments.keyValue("request.id", requestId),
                StructuredArguments.keyValue("assigned_department", assignedDepartment)
        );
    }

    public void workOrderAssigned(String workOrderId, String assignedDepartment) {
        BUSINESS_EVENTS.info("workorder.assigned",
                StructuredArguments.keyValue("event.type", "workorder.assigned"),
                StructuredArguments.keyValue("work_order.id", workOrderId),
                StructuredArguments.keyValue("assigned_department", assignedDepartment)
        );
    }

    public void workOrderAcknowledged(String workOrderId) {
        BUSINESS_EVENTS.info("workorder.acknowledged",
                StructuredArguments.keyValue("event.type", "workorder.acknowledged"),
                StructuredArguments.keyValue("work_order.id", workOrderId)
        );
    }

    public void workOrderResolved(String workOrderId) {
        BUSINESS_EVENTS.info("workorder.resolved",
                StructuredArguments.keyValue("event.type", "workorder.resolved"),
                StructuredArguments.keyValue("work_order.id", workOrderId)
        );
    }

    public void incidentCreated(String incidentId, String assetId, String severity) {
        BUSINESS_EVENTS.info("incident.created",
                StructuredArguments.keyValue("event.type", "incident.created"),
                StructuredArguments.keyValue("incident.id", incidentId),
                StructuredArguments.keyValue("asset.id", assetId),
                StructuredArguments.keyValue("severity", severity)
        );
    }

    public void incidentCommented(String incidentId, String author) {
        BUSINESS_EVENTS.info("incident.commented",
                StructuredArguments.keyValue("event.type", "incident.commented"),
                StructuredArguments.keyValue("incident.id", incidentId),
                StructuredArguments.keyValue("comment.author", author)
        );
    }

    public void incidentResolved(String incidentId, String severity) {
        BUSINESS_EVENTS.info("incident.resolved",
                StructuredArguments.keyValue("event.type", "incident.resolved"),
                StructuredArguments.keyValue("incident.id", incidentId),
                StructuredArguments.keyValue("severity", severity)
        );
    }

    public void iotAnomalyDetected(String assetId, String anomalyType) {
        BUSINESS_EVENTS.info("iot.anomaly_detected",
                StructuredArguments.keyValue("event.type", "iot.anomaly_detected"),
                StructuredArguments.keyValue("asset.id", assetId),
                StructuredArguments.keyValue("anomaly.type", anomalyType)
        );
    }
}
