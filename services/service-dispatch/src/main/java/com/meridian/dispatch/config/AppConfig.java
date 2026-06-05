package com.meridian.dispatch.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    @Value("${city-operations.url}")
    private String cityOperationsUrl;

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        // RestTemplateBuilder.connectTimeout/readTimeout were removed in Spring Boot 3.0.
        // Configure timeouts via SimpleClientHttpRequestFactory instead.
        return builder
                .requestFactory(() -> {
                    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                    factory.setConnectTimeout(5_000);
                    factory.setReadTimeout(5_000);
                    return factory;
                })
                .build();
    }
}
