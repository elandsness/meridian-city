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
import java.util.stream.Collectors;

/**
 * Loads the entity-config JSON once at startup and filters it down to the 
 * entity types this instance owns based on its assigned service role.
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

        String role = properties.getServiceRole();
        if (role == null || role.isBlank()) {
            log.info("No service role defined for this instance — owning ALL entity types.");
            ownedDefinitions = allDefinitions;
        } else {
            ownedDefinitions = allDefinitions.entrySet().stream()
                    .filter(e -> role.equalsIgnoreCase(e.getValue().getDomain()))
                    .collect(Collectors.toMap(
                            Map.Entry::getKey, 
                            Map.Entry::getValue, 
                            (v1, v2) -> v1, 
                            LinkedHashMap::new));
            log.info("Service role '{}' detected. Loaded {}/{} entity types.", 
                    role, ownedDefinitions.size(), allDefinitions.size());
        }
    }

    public EntityDefinition require(String entityType) {
        EntityDefinition def = allDefinitions.get(entityType);
        if (def == null) {
            throw new IllegalArgumentException("Unknown entity type: " + entityType);
        }
        return def;
    }
}
