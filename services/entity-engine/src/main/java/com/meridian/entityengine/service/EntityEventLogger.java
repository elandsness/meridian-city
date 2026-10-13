package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityRecord;
import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * The Semantic Bridge: translate generic entity transitions into domain-specific 
 * business events based on the Industry Config.
 */
@Component
public class EntityEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void transitioned(EntityRecord record, String fromState, EntityDefinition def) {
        transitioned(record, fromState, null, def, OffsetDateTime.now());
    }

    public void transitioned(EntityRecord record, String fromState, EntityDefinition.TransitionDef transition, EntityDefinition def) {
        transitioned(record, fromState, transition, def, OffsetDateTime.now());
    }

    public void transitioned(EntityRecord record, String fromState, EntityDefinition.TransitionDef transition, EntityDefinition def, OffsetDateTime timestamp) {
        // Use the semantic state as the absolute system-of-record event identity.
        // This ensures that auto-derived Business Flows (based on the state machine) always have data.
        String eventType = record.getEntityType() + "." + record.getState();
        List<Object> args = new ArrayList<>();
        
        args.add(StructuredArguments.keyValue("event.type", eventType));
        args.add(StructuredArguments.keyValue(record.getEntityType() + ".id", record.getId()));

        // If a semantic signal alias exists, add it as a supplementary attribute for legacy/pretty reporting.
        if (transition != null && transition.getSignal() != null) {
            EntityDefinition.SignalDef signal = transition.getSignal();
            args.add(StructuredArguments.keyValue("event.signal", signal.getEventType()));
            
            String corrIdField = signal.getCorrelationId();
            if (corrIdField != null) {
                args.add(StructuredArguments.keyValue(corrIdField, record.getField(corrIdField)));
            }
        }

        // 2. Enrichment: Always add metadata and the full state of the entity
        args.add(StructuredArguments.keyValue("event.timestamp", timestamp));
        args.add(StructuredArguments.keyValue(record.getEntityType() + ".from_state", fromState));
        args.add(StructuredArguments.keyValue(record.getEntityType() + ".state", record.getState()));

        if (def != null) {
            def.getFields().forEach((fieldName, fieldDef) -> {
                if ("password".equals(fieldDef.getType())) return;
                Object value = "ref".equals(fieldDef.getType()) ? record.getLink(fieldName) : record.getField(fieldName);
                args.add(StructuredArguments.keyValue(record.getEntityType() + "." + fieldName, value));
            });
        }

        BUSINESS_EVENTS.info(eventType, args.toArray());
    }
}
