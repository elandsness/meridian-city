package com.meridian.entityengine.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Loads the entity-config JSON once at startup (mirrors how RoutingEngine parses
 * ROUTING_MAP once at construction) and filters it down to the entity types this
 * instance owns. Uses its OWN ObjectMapper (default camelCase) rather than the
 * Spring-managed request/response one, which is globally configured SNAKE_CASE
 * for the HTTP API (API_CONVENTIONS §1) — the entity-config's structural keys
 * (displayName, idPrefix, minSeconds, ...) are camelCase per the authoring
 * convention, a different naming domain entirely from the API wire format.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EntityConfigLoader {

    private final ResourceLoader resourceLoader;
    private final EntityEngineProperties properties;
    private final ObjectMapper configMapper = new ObjectMapper();

    @Getter
    private Map<String, EntityDefinition> allDefinitions = Map.of();

    @Getter
    private Map<String, EntityDefinition> ownedDefinitions = Map.of();

    @PostConstruct
    void load() {
        Resource resource = resourceLoader.getResource(properties.getConfigPath());
        if (!resource.exists()) {
            log.warn("Entity config not found at {} — this instance owns no entity types.", properties.getConfigPath());
            return;
        }
        try (InputStream in = resource.getInputStream()) {
            Map<String, EntityDefinition> parsed = configMapper.readValue(in,
                    configMapper.getTypeFactory().constructMapType(LinkedHashMap.class, String.class, EntityDefinition.class));
            allDefinitions = parsed;
        } catch (IOException e) {
            throw new IllegalStateException("Failed to parse entity config at " + properties.getConfigPath(), e);
        }

        Set<String> owned = Set.copyOf(properties.ownedTypesList());
        ownedDefinitions = owned.isEmpty()
                ? allDefinitions
                : allDefinitions.entrySet().stream()
                    .filter(e -> owned.contains(e.getKey()))
                    .collect(LinkedHashMap::new, (m, e) -> m.put(e.getKey(), e.getValue()), LinkedHashMap::putAll);

        log.info("Loaded {} entity type(s) from {}; this instance owns: {}",
                allDefinitions.size(), properties.getConfigPath(), ownedDefinitions.keySet());
    }

    public EntityDefinition require(String entityType) {
        EntityDefinition def = allDefinitions.get(entityType);
        if (def == null) {
            throw new IllegalArgumentException("Unknown entity type: " + entityType);
        }
        return def;
    }
}
