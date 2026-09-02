package com.meridian.transaction.messaging;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic transactionEventsTopic() {
        return new NewTopic("transaction.events", 2, (short) 1);
    }
}
