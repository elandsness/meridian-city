package com.meridian.commerce.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Mutable fault-injection configuration (db-slowdown on checkout writes).
 * Bound from application.yml at startup, updated at runtime by AdminController.
 */
@Component
@ConfigurationProperties(prefix = "fault")
@Data
public class FaultInjectionConfig {

    private DbSlowdown dbSlowdown = new DbSlowdown();

    @Data
    public static class DbSlowdown {
        private boolean enabled = false;
        private long delayMs = 0;
    }
}
