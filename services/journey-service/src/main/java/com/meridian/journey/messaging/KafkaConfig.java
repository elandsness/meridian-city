package com.meridian.journey.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic journeyEventsTopic() {
        return new NewTopic("journey.events", 1, (short) 1);
    }
}
