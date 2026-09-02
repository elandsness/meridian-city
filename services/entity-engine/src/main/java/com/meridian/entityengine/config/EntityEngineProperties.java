package com.meridian.entityengine.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConfigurationProperties(prefix = "entity-engine")
@Data
public class EntityEngineProperties {

    /** Spring resource location of the entity-config JSON (classpath: or a filesystem path). */
    private String configPath = "classpath:dev-entity-config.json";

    /** Comma-separated allow-list of entity type ids this instance owns; empty = own everything. */
    private String ownedTypes = "";

    private long schedulerFixedDelayMs = 5000;

    private String kafkaGroupId = "entity-engine-group";

    private boolean kafkaTriggersEnabled = false;

    public List<String> ownedTypesList() {
        if (ownedTypes == null || ownedTypes.isBlank()) return List.of();
        return List.of(ownedTypes.split(",")).stream().map(String::trim).filter(s -> !s.isBlank()).toList();
    }
}
