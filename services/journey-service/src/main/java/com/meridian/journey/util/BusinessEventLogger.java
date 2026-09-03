package com.meridian.journey.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Structured Business Events for the Journey funnels.
 * Discriminator key: "event.type" (see docs/INSTRUMENTATION.md).
 *
 * event.type is "journey.<status>" (e.g. "journey.in_progress", "journey.completed"),
 * matching the "<entity_type>.<state>" convention every other entity-type's Business
 * Flow steps use (see provision-dynatrace-business-config.py's
 * derive_flow_specs_from_entity_config(), which builds a flow's steps directly from
 * industry.entities.journey.states -- there is no hand-written flow spec for journey,
 * so its event names must match that generic convention exactly or the auto-derived
 * flow never sees any data). Previously emitted a single "journey.status_changed"
 * event with a status field instead, which doesn't match any step in a derived flow.
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void journeyStatus(com.meridian.journey.domain.Journey journey) {
        String eventType = "journey." + journey.getStatus();
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue("journey.id", journey.getId()),
                StructuredArguments.keyValue("entity.type", journey.getEntityType()),
                StructuredArguments.keyValue("journey.status", journey.getStatus()),
                StructuredArguments.keyValue("journey.progress", journey.getProgress())
        );
    }
}
