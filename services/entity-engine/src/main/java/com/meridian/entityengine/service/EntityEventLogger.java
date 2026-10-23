package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityRecord;
import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
        String entityIdKey = record.getEntityType() + ".id";
        args.add(StructuredArguments.keyValue(entityIdKey, record.getId()));

        Set<String> addedKeys = new HashSet<>();
        addedKeys.add(entityIdKey);

        // If a semantic signal alias exists, add it as a supplementary attribute for legacy/pretty reporting.
        if (transition != null && transition.getSignal() != null) {
            EntityDefinition.SignalDef signal = transition.getSignal();
            args.add(StructuredArguments.keyValue("event.signal", signal.getEventType()));
            
            String corrIdKey = signal.getCorrelationId();
            if (corrIdKey != null && !addedKeys.contains(corrIdKey)) {
                String fieldName = corrIdKey.startsWith(record.getEntityType() + ".") 
                    ? corrIdKey.substring(record.getEntityType().length() + 1) 
                    : corrIdKey;
                Object corrValue = "id".equals(fieldName) ? record.getId() : record.getField(fieldName);
                args.add(StructuredArguments.keyValue(corrIdKey, corrValue));
                addedKeys.add(corrIdKey);
            }
        }

        // 2. Enrichment: Always add metadata and the full state of the entity
        args.add(StructuredArguments.keyValue("event.timestamp", timestamp));
        args.add(StructuredArguments.keyValue(record.getEntityType() + ".from_state", fromState));
        args.add(StructuredArguments.keyValue(record.getEntityType() + ".state", record.getState()));

        if (def != null) {
            def.getFields().forEach((fieldName, fieldDef) -> {
                String fieldKey = record.getEntityType() + "." + fieldName;
                if ("password".equals(fieldDef.getType()) || "id".equals(fieldName) || addedKeys.contains(fieldKey)) return;
                Object value = "ref".equals(fieldDef.getType()) ? record.getLink(fieldName) : record.getField(fieldName);
                args.add(StructuredArguments.keyValue(fieldKey, value));
            });
        }

        BUSINESS_EVENTS.info(eventType, args.toArray());
    }
}
