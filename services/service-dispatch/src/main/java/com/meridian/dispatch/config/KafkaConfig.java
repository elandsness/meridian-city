package com.meridian.dispatch.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic requestsEventsTopic() {
        return TopicBuilder.name("requests.events")
                .partitions(2)
                .replicas(1)
                .build();
    }
}
