package com.meridian.entityengine.dto;

import com.meridian.entityengine.config.EntityDefinition;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Lean, read-only summary of one configured entity type -- just enough for a
 * generic consumer (e.g. the ops Command Center aggregator) to discover what
 * entity types and states exist without parsing the industry config itself.
 */
public class EntityTypeSummary {

    private final String entityType;
    private final EntityDefinition def;

    public EntityTypeSummary(String entityType, EntityDefinition def) {
        this.entityType = entityType;
        this.def = def;
    }

    public String getEntityType() { return entityType; }
    public String getDisplayName() { return def.getDisplayName(); }
    public String getDisplayNamePlural() { return def.getDisplayNamePlural(); }

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

        public String getLabel() { return s.getLabel(); }
        public String getTone() { return s.getTone(); }
        public boolean isTerminal() { return s.isTerminal(); }
        public boolean isError() { return s.isError(); }
    }
}
