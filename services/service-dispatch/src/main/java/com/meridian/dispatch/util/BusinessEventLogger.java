package com.meridian.dispatch.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void logDispatched(String requestId, String citizenId, String assignedDepartment, String zoneId) {
        BUSINESS_EVENTS.info("service_request.dispatched",
                StructuredArguments.keyValue("event.type", "service_request.dispatched"),
                StructuredArguments.keyValue("request.id", requestId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("assigned_department", assignedDepartment),
                StructuredArguments.keyValue("zone_id", zoneId)
        );
    }

    public void logAssigned(String requestId, String assignedDepartment) {
        BUSINESS_EVENTS.info("service_request.assigned",
                StructuredArguments.keyValue("event.type", "service_request.assigned"),
                StructuredArguments.keyValue("request.id", requestId),
                StructuredArguments.keyValue("assigned_department", assignedDepartment)
        );
    }
}
