package com.meridian.entityengine.messaging;

import com.meridian.entityengine.config.EntityConfigLoader;
import com.meridian.entityengine.service.EntityEngineService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Generic kafkaTrigger bridge: for each incoming Kafka message, finds every
 * owned entity type that declares a trigger for that topic, resolves the
 * field mapping from the message payload (same {from,value,map,default} spec
 * as callService body), and calls EntityEngineService.create().
 *
 * <p>Conditional on entity-engine.kafka-triggers-enabled=true -- only
 * ops-entity-service sets this; customer-entity-service never connects to Kafka.
 *
 * <p>Listens to entity-engine.kafka.iot-topic (default: iot.anomalies) for Stage 6.
 * The routing logic is fully generic: any entity type declaring a trigger for this
 * topic will receive and process the message -- today only 'incident' does.
 */
@Component
@ConditionalOnProperty("entity-engine.kafka-triggers-enabled")
@RequiredArgsConstructor
@Slf4j
public class KafkaTriggerConsumer {

    private final EntityConfigLoader configLoader;
    private final EntityEngineService service;

    @KafkaListener(
        topics = "${entity-engine.kafka.iot-topic:iot.anomalies}",
        containerFactory = "entityEngineKafkaListenerContainerFactory"
    )
    public void onIotAnomaly(ConsumerRecord<String, Object> record) {
        routeMessage(record.topic(), record.value());
    }

    private void routeMessage(String topic, Object value) {
        @SuppressWarnings("unchecked")
        Map<String, Object> payload = value instanceof Map<?, ?> m
                ? (Map<String, Object>) m
                : Map.of();

        configLoader.getOwnedDefinitions().forEach((entityType, def) -> {
            if (def.getTriggers() == null) return;
            def.getTriggers().getKafka().stream()
                    .filter(t -> topic.equals(t.getTopic()))
                    .forEach(trigger -> {
                        Map<String, Object> fields = resolveFieldMapping(payload, trigger.getFieldMapping());
                        log.info("kafkaTrigger: topic={} → create {} with {} fields",
                                topic, entityType, fields.size());
                        service.create(entityType, fields);
                    });
        });
    }

    private Map<String, Object> resolveFieldMapping(Map<String, Object> payload, Map<String, Object> mapping) {
        Map<String, Object> result = new LinkedHashMap<>();
        if (mapping == null) return result;
        mapping.forEach((targetField, spec) -> result.put(targetField, resolveSpec(payload, spec)));
        return result;
    }

    private Object resolveSpec(Map<String, Object> source, Object spec) {
        if (!(spec instanceof Map<?, ?> rawSpec)) return spec; // plain literal
        @SuppressWarnings("unchecked")
        Map<String, Object> specMap = (Map<String, Object>) rawSpec;

        Object raw;
        if (specMap.containsKey("value")) {
            raw = specMap.get("value");
        } else if (specMap.containsKey("from")) {
            raw = source.get(String.valueOf(specMap.get("from")));
        } else {
            raw = null;
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> valueMap = specMap.get("map") instanceof Map<?, ?> m
                ? (Map<String, Object>) m : null;
        if (valueMap != null && raw != null) {
            Object mapped = valueMap.get(String.valueOf(raw));
            return mapped != null ? mapped : specMap.getOrDefault("default", raw);
        }
        return raw != null ? raw : specMap.get("default");
    }
}
