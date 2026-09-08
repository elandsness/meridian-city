package com.meridian.identity.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Structured Business Events for identity registration + the account-creation
 * lifecycle. Discriminator key: "event.type" (see docs/INSTRUMENTATION.md §3).
 * Feeds the "Identity Registration" and "[Meridian] Account Creation" business
 * flows (provision-dynatrace-business-config.py), which expect event.type values
 * "identity.registered" and "account.<stage>" respectively, correlated by
 * identity.id. Previously built these as a nested Map.of(...), a different
 * (unparsed) shape than every other service's BusinessEvents logger, logged
 * under the class logger instead of "BusinessEvents", and with no JSON log
 * encoder configured at all -- so even a successful call never reached
 * Dynatrace as a business event. Map.of also throws NullPointerException on
 * any null value, crashing every registration that omitted the optional
 * zoneId field.
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void identityRegistered(String identityId, String email, String zoneId) {
        BUSINESS_EVENTS.info("identity.registered",
                StructuredArguments.keyValue("event.type", "identity.registered"),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("email", email),
                StructuredArguments.keyValue("zone_id", zoneId)
        );
    }

    public void accountLifecycle(String eventType, String identityId, String email) {
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("email", email)
        );
    }
}
