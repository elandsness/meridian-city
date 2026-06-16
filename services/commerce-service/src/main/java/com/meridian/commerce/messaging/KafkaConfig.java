package com.meridian.commerce.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic commerceEventsTopic() {
        return new NewTopic("commerce.events", 2, (short) 1);
    }
}
