package com.meridian.entityengine.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The shape of one entity type, deserialized from the authored
 * `industry.entities.<id>` config (see docs/industry-config.schema.json's
 * `entityType` $def — this class must stay in lockstep with that schema).
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
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
    private TriggersDef triggers;

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
        @JsonProperty("isError")
        private boolean isError;
        @JsonProperty("isKpi")
        private boolean isKpi;
        private String glyph;
        private String kpiField;
        private boolean externallyTriggered;
    }

    @Data
    public static class TransitionDef {
        private String from;
        private String to;
        private String label;
        private boolean userTriggerable;
        private Map<String, Object> when;
        private TimerDef timer;
        private List<Map<String, Object>> effects = List.of();
        
        /** 
         * The semantic signal to emit when this transition occurs.
         * Maps to the Business Flow events in Dynatrace.
         */
        private SignalDef signal;
    }

    @Data
    public static class SignalDef {
        private String eventType;    // e.g. "passenger.boarded"
        private String correlationId; // e.g. "passenger.id"
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
        private Map<String, Object> fields = Map.of();
        private String ownerEntityType;
        private String ownerField;
        private String periodField;
        private String periodFrequency;
        private BackfillDef backfill;
        private AmountRangeDef amount;
        private Integer dueDays;
    }

    @Data
    public static class BackfillDef {
        private int minPeriods;
        private int maxPeriods;
        private int outstandingMin;
        private int outstandingMax;
    }

    @Data
    public static class AmountRangeDef {
        private long minCents;
        private long maxCents;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TriggersDef {
        private List<KafkaTriggerDef> kafka = List.of();
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class KafkaTriggerDef {
        private String topic;
        private Map<String, Object> fieldMapping = Map.of();
    }
}
