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

    /** The role of this instance (e.g. 'customer', 'ops'). Used to discover owned entities. */
    private String serviceRole = "";

    private long schedulerFixedDelayMs = 5000;

    private String kafkaGroupId = "entity-engine-group";

    private boolean kafkaTriggersEnabled = false;
}
