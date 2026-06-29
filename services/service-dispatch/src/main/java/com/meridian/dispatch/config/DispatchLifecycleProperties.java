package com.meridian.dispatch.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Master switch for the {@link com.meridian.dispatch.service.DispatchLifecycleScheduler},
 * which emits the deferred dispatched/assigned business events at the absolute targets
 * citizen-service supplied. No delay band lives here — citizen-service owns the Service
 * Request timeline; service-dispatch just fires at the times it is handed.
 */
@Component
@ConfigurationProperties(prefix = "dispatch-lifecycle")
@Data
public class DispatchLifecycleProperties {

    private boolean enabled = true;
}
