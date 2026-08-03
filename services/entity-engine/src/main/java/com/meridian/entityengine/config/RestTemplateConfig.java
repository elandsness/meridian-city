package com.meridian.entityengine.config;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/** The one outbound HTTP client entity-engine needs for callService effects
 * (e.g. asking routing-service for a department) -- OneAgent auto-instruments
 * it the same way it already does DispatchClient's RestTemplate today, no
 * manual trace-propagation code needed. */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
    }
}
