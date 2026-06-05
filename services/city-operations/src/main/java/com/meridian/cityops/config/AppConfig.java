package com.meridian.cityops.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

@Configuration
public class AppConfig {

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate(ProducerFactory<String, Object> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
    }

    @Bean
    public NewTopic notificationsOutboundTopic() {
        return TopicBuilder.name("notifications.outbound")
                .partitions(3)
                .replicas(1)
                .build();
    }

    @Bean
    public NewTopic iotAnomaliesTopic() {
        return TopicBuilder.name("iot.anomalies")
                .partitions(3)
                .replicas(1)
                .build();
    }
}
