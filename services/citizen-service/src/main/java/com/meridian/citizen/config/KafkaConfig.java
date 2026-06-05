package com.meridian.citizen.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic requestsEventsTopic() {
        return new NewTopic("requests.events", 2, (short) 1);
    }
}
