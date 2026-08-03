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
 *
 * <p>Deliberately Tier 2: fields, states, conditional/timed transitions,
 * cross-entity links, one computed value (position), and a generator. No
 * scripting, no arbitrary branching beyond the closed condition/effect
 * vocabulary in {@link TransitionDef}.
 *
 * <p>Unknown keys (e.g. `triggers` before task #21's Kafka bridge is wired)
 * are silently ignored so the config can evolve ahead of the engine code.
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
        /** isKpi states only: sum this field across every entity reaching this state
         * (kpiCalculation="sum" in the derived Business Flow) instead of the default
         * lastEvent count of entities reaching it -- e.g. a "delivered" order state
         * declaring kpiField "totalCents" reproduces a Revenue KPI, not just a count. */
        private String kpiField;
    }

    @Data
    public static class TransitionDef {
        private String from;
        private String to;
        private String label;
        private boolean userTriggerable;
        /**
         * {field,equals|notEquals} | {probability} | {faultGate:"<gateName>",probability}
         * | {link,field,equals}. faultGate's value is a gate NAME (not a boolean) looked
         * up in FaultGateRegistry at evaluation time; the sibling `probability` is only
         * the config-authored DEFAULT rate used the first time that gate is referenced
         * (a gate is seeded enabled iff its default rate is positive, matching every
         * hand-written FaultState/FaultInjectionConfig's own off-by-default convention) --
         * an admin can override enabled/rate at runtime via FaultGateAdminController.
         */
        private Map<String, Object> when;
        private TimerDef timer;
        /**
         * {target,action,field?,value|by?} for set/increment (target is "self" or
         * "link.<refFieldName>"). spawnLinked/callService effects use a different shape
         * (no `target` resolution against this entity's own links -- they build a brand
         * new entity or an outbound call instead): spawnLinked is
         * {action:"spawnLinked", entityType, fields:{fieldName:{value|from,map?,default?}}};
         * callService is {action:"callService", url, method?, body:{...same field-spec
         * shape...}, responseFields:{selfField: responseJsonKey}}. See EffectExecutor.
         */
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
        // periodicHistoryBackfill only (Stage 6): generalizes billing-service's two tax-bill
        // generators (one-time per-citizen quarter backfill + ongoing per-period issuance)
        // into one strategy that, per tick, tops up every ownerEntityType instance to have
        // a record for the current period -- backfilling missing history the first time an
        // owner is seen, issuing just the current period afterwards. See TransitionScheduler.
        private String ownerEntityType;
        private String ownerField;
        private String periodField;
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

    /** Top-level triggers block on an entity type -- currently supports Kafka only. */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TriggersDef {
        private List<KafkaTriggerDef> kafka = List.of();
    }

    /**
     * Declares that a Kafka message on `topic` should create a new entity of the
     * enclosing type. `fieldMapping` maps entity field names to field-spec objects
     * using the same {from, value, map, default} vocabulary as callService body --
     * resolved against the Kafka message payload (treated as the "source").
     */
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class KafkaTriggerDef {
        private String topic;
        /** {entityField: {from: msgKey} | {value: literal} | {from, map, default}} */
        private Map<String, Object> fieldMapping = Map.of();
    }
}
