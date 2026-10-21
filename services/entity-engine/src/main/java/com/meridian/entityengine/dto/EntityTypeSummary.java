package com.meridian.entityengine.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.meridian.entityengine.config.EntityDefinition;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Lean, read-only summary of one configured entity type -- just enough for a
 * generic consumer (e.g. the ops Command Center aggregator) to discover what
 * entity types and states exist without parsing the industry config itself.
 *
 * Every field has an explicit @JsonProperty name: this service's global
 * spring.jackson.property-naming-strategy is SNAKE_CASE, and leaving names
 * implicit led to a real bug (isError() auto-strips to "error", not
 * "is_error" -- easy to get wrong from either side). Spelling every key out
 * here makes the wire contract unambiguous to read, matching the
 * entity-config's own @JsonProperty("isError") precedent in EntityDefinition.
 */
public class EntityTypeSummary {

    private final String entityType;
    private final EntityDefinition def;

    public EntityTypeSummary(String entityType, EntityDefinition def) {
        this.entityType = entityType;
        this.def = def;
    }

    @JsonProperty("entity_type")
    public String getEntityType() { return entityType; }

    @JsonProperty("display_name")
    public String getDisplayName() { return def.getDisplayName(); }

    @JsonProperty("display_name_plural")
    public String getDisplayNamePlural() { return def.getDisplayNamePlural(); }

    @JsonProperty("states")
    public Map<String, StateSummary> getStates() {
        Map<String, StateSummary> out = new LinkedHashMap<>();
        def.getStates().forEach((id, s) -> out.put(id, new StateSummary(s)));
        return out;
    }

    public static class StateSummary {
        private final EntityDefinition.StateDef s;

        StateSummary(EntityDefinition.StateDef s) {
            this.s = s;
        }

        @JsonProperty("label")
        public String getLabel() { return s.getLabel(); }

        @JsonProperty("tone")
        public String getTone() { return s.getTone(); }

        @JsonProperty("terminal")
        public boolean isTerminal() { return s.isTerminal(); }

        @JsonProperty("is_error")
        public boolean isError() { return s.isError(); }
    }
}
