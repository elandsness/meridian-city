package com.meridian.entityengine.service;

import com.meridian.entityengine.config.EntityDefinition;
import com.meridian.entityengine.domain.EntityRecord;
import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Emits structured Business Event log lines, same "BusinessEvents"-logger
 * convention every hand-written per-service BusinessEventLogger already used
 * (citizen-service, city-operations, flight-ops, ...) -- but generic, since
 * only entity-engine owns lifecycle state now. Replaces all of those with one
 * emitter driven by the entity-config's field list rather than one hand-copied
 * class per service.
 *
 * <p>Emits every field the entity type declares (not just id/state) -- Stage 6
 * needs this so provision-dynatrace-business-config.py's fieldsAdd allowlist
 * (a strict allowlist against real Grail data, see that file's own header
 * comment) actually has something to extract for KPI sums (e.g. an order's
 * totalCents) and any other business-field a flow's dashboard cares about, not
 * just correlation ids.
 */
@Component
public class EntityEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void transitioned(EntityRecord record, String fromState, EntityDefinition def) {
        String eventType = record.getEntityType() + "." + record.getState();
        List<Object> args = new ArrayList<>(List.of(
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(record.getEntityType() + ".id", record.getId()),
                StructuredArguments.keyValue(record.getEntityType() + ".from_state", fromState),
                StructuredArguments.keyValue(record.getEntityType() + ".state", record.getState())));
        if (def != null) {
            def.getFields().forEach((fieldName, fieldDef) -> {
                // Never log a password field's value, even hashed -- it has no business
                // meaning for a flow/KPI and hashes have no business being in log output.
                if ("password".equals(fieldDef.getType())) return;
                // A ref-typed field's real value lives in `links`, not `data` (see
                // EntityFactory.build).
                Object value = "ref".equals(fieldDef.getType()) ? record.getLink(fieldName) : record.getField(fieldName);
                args.add(StructuredArguments.keyValue(record.getEntityType() + "." + fieldName, value));
            });
        }
        BUSINESS_EVENTS.info(eventType, args.toArray());
    }
}
