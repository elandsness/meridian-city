package com.meridian.identity.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Logs Dynatrace business events as JSON lines. The Dynatrace Kubernetes Log Module
 * (or the meridian log collector DaemonSet) captures these and extracts them as
 * Business Events in Grail. The "[Meridian] Account Creation" business flow uses
 * these to track the account-creation funnel.
 */
@Component
public class BusinessEventLogger {

    private static final Logger log = LoggerFactory.getLogger(BusinessEventLogger.class);

    public void identityRegistered(String identityId, String email, String zoneId) {
        Map<String, Object> event = Map.of(
                "meridian.identity.registered",
                Map.of(
                        "identity.id", identityId,
                        "email", email,
                        "zoneId", zoneId
                )
        );
        logBusinessEvent(event);
    }

    public void accountLifecycle(String eventType, String identityId, String email) {
        Map<String, Object> event = Map.of(
                "meridian.account.lifecycle",
                Map.of(
                        "identity.id", identityId,
                        "email", email,
                        "event_type", eventType
                )
        );
        logBusinessEvent(event);
    }

    private void logBusinessEvent(Map<String, Object> event) {
        log.info("BusinessEvent: {}", event);
    }
}
