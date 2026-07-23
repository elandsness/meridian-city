package com.meridian.entityengine.service;

import com.meridian.entityengine.domain.EntityRecord;
import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits structured Business Event log lines, same "BusinessEvents"-logger
 * convention every hand-written per-service BusinessEventLogger already uses
 * (citizen-service, city-operations, flight-ops, ...) -- but generic, since
 * only entity-engine owns lifecycle state now. Replaces all of those with one
 * emitter driven by the entity-config's field list rather than one hand-copied
 * class per service.
 */
@Component
public class EntityEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void transitioned(EntityRecord record, String fromState) {
        String eventType = record.getEntityType() + "." + record.getState();
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(record.getEntityType() + ".id", record.getId()),
                StructuredArguments.keyValue(record.getEntityType() + ".from_state", fromState),
                StructuredArguments.keyValue(record.getEntityType() + ".state", record.getState()));
    }
}
