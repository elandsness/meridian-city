package com.meridian.citizen.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits structured Business Event log lines consumed by Dynatrace Business Events.
 * Uses the dedicated "BusinessEvents" logger so Dynatrace log processing rules can
 * target these entries specifically.
 *
 * Each call produces a JSON log record (via logstash-logback-encoder) with the
 * event.type field plus all provided key-value pairs as top-level JSON fields.
 * Example output:
 * {"timestamp":"...","level":"INFO","service":"citizen-service",
 *  "event.type":"service_request.submitted","citizen.id":"cit-abc12",
 *  "request.id":"req-xyz34","request.category":"infrastructure","request.priority":"normal"}
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    /**
     * Emit a citizen.registered business event.
     */
    public void citizenRegistered(String citizenId, String email, String zoneId) {
        BUSINESS_EVENTS.info("citizen.registered",
                StructuredArguments.keyValue("event.type", "citizen.registered"),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("citizen.email", email),
                StructuredArguments.keyValue("citizen.zone_id", zoneId));
    }

    /**
     * Emit an account-creation lifecycle business event
     * (account.registration_started / details_submitted / verification_sent /
     * verified / activated).
     */
    public void accountLifecycle(String eventType, String citizenId, String email) {
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("citizen.email", email));
    }

    /**
     * Emit a service_request.submitted business event.
     */
    public void requestSubmitted(String requestId, String citizenId, String category,
                                  String priority, String zoneId) {
        BUSINESS_EVENTS.info("service_request.submitted",
                StructuredArguments.keyValue("event.type", "service_request.submitted"),
                StructuredArguments.keyValue("request.id", requestId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("request.category", category),
                StructuredArguments.keyValue("request.priority", priority),
                StructuredArguments.keyValue("request.zone_id", zoneId));
    }

    /**
     * Emit a service_request.validated business event (after dispatch acknowledgement).
     */
    public void requestValidated(String requestId, String citizenId, String category,
                                  String priority) {
        BUSINESS_EVENTS.info("service_request.validated",
                StructuredArguments.keyValue("event.type", "service_request.validated"),
                StructuredArguments.keyValue("request.id", requestId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("request.category", category),
                StructuredArguments.keyValue("request.priority", priority));
    }

    /**
     * Emit a service_request.status_updated business event.
     */
    public void requestStatusUpdated(String requestId, String citizenId, String oldStatus,
                                      String newStatus, String assignedDepartment) {
        BUSINESS_EVENTS.info("service_request.status_updated",
                StructuredArguments.keyValue("event.type", "service_request.status_updated"),
                StructuredArguments.keyValue("request.id", requestId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("request.status.previous", oldStatus),
                StructuredArguments.keyValue("request.status.new", newStatus),
                StructuredArguments.keyValue("request.assigned_department", assignedDepartment));
    }
}
