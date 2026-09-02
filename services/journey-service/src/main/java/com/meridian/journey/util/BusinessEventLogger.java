package com.meridian.journey.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Structured Business Events for the Journey funnels.
 * Discriminator key: "event.type" (see docs/INSTRUMENTATION.md).
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void journeyStatus(com.meridian.journey.domain.Journey journey) {
        BUSINESS_EVENTS.info("journey.status_changed",
                StructuredArguments.keyValue("event.type", "journey.status_changed"),
                StructuredArguments.keyValue("journey.id", journey.getId()),
                StructuredArguments.keyValue("entity.type", journey.getEntityType()),
                StructuredArguments.keyValue("journey.status", journey.getStatus()),
                StructuredArguments.keyValue("journey.progress", journey.getProgress())
        );
    }
}
