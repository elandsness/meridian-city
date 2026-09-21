package com.meridian.workflow.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.io.File;
import java.io.IOException;

@Service
public class ConfigService {
    private static final Logger log = LoggerFactory.getLogger(ConfigService.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final String configPath = System.getenv().getOrDefault("INDUSTRY_CONFIG_PATH", "/etc/config/config.json");
    private JsonNode cachedConfig;

    public JsonNode getConfig() {
        if (cachedConfig == null) {
            try {
                File file = new File(configPath);
                if (file.exists()) {
                    cachedConfig = mapper.readTree(file);
                    log.info("Loaded industry config from {}", configPath);
                } else {
                    log.warn("Industry config file not found at {}", configPath);
                }
            } catch (IOException e) {
                log.error("Failed to load industry config: {}", e.getMessage());
            }
        }
        return cachedConfig;
    }

    public String getEntityType(String genericType) {
        JsonNode config = getConfig();
        if (config == null || !config.has("entities")) return genericType;
        // In a truly generic engine, we might map 'incident' -> 'operational_incident'
        // based on a mapping table. For now, we'll return the generic type 
        // but provide the hook here for future mapping.
        return genericType;
    }
}
