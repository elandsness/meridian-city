package com.meridian.entityengine.config;

import org.springframework.boot.restclient.RestTemplateBuilder;
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
                .connectTimeout(Duration.ofSeconds(5))
                .readTimeout(Duration.ofSeconds(5))
                .build();
    }
}
