package com.meridian.entityengine.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The shape of one entity type, deserialized from the authored
 * `industry.entities.<id>` config (see docs/industry-config.schema.json's
 * `entityType` $def — this class must stay in lockstep with that schema).
 *
 * <p>Deliberately Tier 2: fields, states, conditional/timed transitions,
 * cross-entity links, one computed value (position), and a generator. No
 * scripting, no arbitrary branching beyond the closed condition/effect
 * vocabulary in {@link TransitionDef}.
 */
@Data
public class EntityDefinition {

    private String displayName;
    private String displayNamePlural;
    private String idPrefix;
    private Map<String, FieldDef> fields = new LinkedHashMap<>();
    private String initial;
    private Map<String, StateDef> states = new LinkedHashMap<>();
    private List<TransitionDef> transitions = List.of();
    private Map<String, LinkOnCreateDef> linkOnCreate = Map.of();
    private ComputedDef computed;
    private GeneratorDef generator;

    @Data
    public static class FieldDef {
        private String type; // string | number | boolean | date | enum | ref
        private boolean required;
        @JsonProperty("default")
        private Object defaultValue;
        private List<String> values; // enum type only
        private String entity; // ref type only: another entity type id
    }

    @Data
    public static class StateDef {
        private String label;
        private String tone;
        private boolean terminal;
        // Lombok generates isError()/isKpi() getters for these (it doesn't double
        // up "is" since the field already starts with it) -- but Jackson then
        // derives the JSON property name by stripping "is" from ANY isXxx()
        // getter, landing on "error"/"kpi", not "isError"/"isKpi". Pin the JSON
        // name explicitly rather than rename the field and disagree with the
        // schema/docs/authoring vocabulary everywhere else.
        @JsonProperty("isError")
        private boolean isError;
        @JsonProperty("isKpi")
        private boolean isKpi;
        private String glyph;
    }

    @Data
    public static class TransitionDef {
        private String from;
        private String to;
        private String label;
        private boolean userTriggerable;
        /** {field,equals|notEquals} | {probability} | {faultGate,probability} | {link,field,equals}. */
        private Map<String, Object> when;
        private TimerDef timer;
        /** {target,action,field?} — target is "self" or "link.<refFieldName>"; action is set|increment|transition|spawnLinked|callService. */
        private List<Map<String, Object>> effects = List.of();
    }

    @Data
    public static class TimerDef {
        private Double minSeconds;
        private Double maxSeconds;
    }

    @Data
    public static class LinkOnCreateDef {
        private Map<String, Object> query;
        private String strategy;
        private boolean required;
    }

    @Data
    public static class ComputedDef {
        private PositionDef position;
    }

    @Data
    public static class PositionDef {
        private String type; // "point2d"
        private String interpolation; // linear | easeInOut
        private Map<String, Waypoint> waypoints; // state -> {x,y}
    }

    @Data
    public static class Waypoint {
        private double x;
        private double y;
    }

    @Data
    public static class GeneratorDef {
        private String strategy; // simpleSteadyState | periodicHistoryBackfill
        private Long intervalMs;
        private Integer maxActive;
        private Map<String, Map<String, Object>> fields = Map.of();
    }
}
