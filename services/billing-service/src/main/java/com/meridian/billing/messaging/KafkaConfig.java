package com.meridian.billing.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic billingEventsTopic() {
        return new NewTopic("billing.events", 1, (short) 1);
    }
}
