package com.meridian.cityops.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Mutable fault-injection configuration.
 * Bound from application.yml at startup and updated at runtime by AdminController.
 * Using @Component + @ConfigurationProperties on the same bean makes the instance
 * mutable — the AdminController can modify the fields directly.
 */
@Component
@ConfigurationProperties(prefix = "fault")
@Data
public class FaultInjectionConfig {

    private DbSlowdown dbSlowdown = new DbSlowdown();
    private CpuSpike cpuSpike = new CpuSpike();

    @Data
    public static class DbSlowdown {
        private boolean enabled = false;
        private long delayMs = 0;
    }

    @Data
    public static class CpuSpike {
        private boolean enabled = false;
    }
}
