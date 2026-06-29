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
    private Escalation escalation = new Escalation();

    @Data
    public static class DbSlowdown {
        private boolean enabled = false;
        private long delayMs = 0;
    }

    @Data
    public static class CpuSpike {
        private boolean enabled = false;
    }

    /**
     * Business-exception toggle (default off): escalate a share of acknowledged work
     * orders instead of resolving them, so the IoT Incident Resolution business flow shows
     * a workorder.escalated error branch + drop-off at the resolution step.
     */
    @Data
    public static class Escalation {
        private boolean enabled = false;
        private double rate = 0.0;
    }
}
