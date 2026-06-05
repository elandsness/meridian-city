package com.meridian.cityops.messaging;

import com.meridian.cityops.domain.WorkOrder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Publishes outbound notification events to the notifications.outbound Kafka topic.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotificationPublisher {

    private static final String TOPIC = "notifications.outbound";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    /**
     * Publishes a work_order_created notification for downstream consumers.
     *
     * @param workOrder the newly created work order
     */
    public void publishWorkOrderCreated(WorkOrder workOrder) {
        Map<String, Object> payload = Map.of(
                "type", "work_order_created",
                "workOrderId", workOrder.getId(),
                "requestId", workOrder.getRequestId() != null ? workOrder.getRequestId() : "",
                "department", workOrder.getAssignedDepartment() != null ? workOrder.getAssignedDepartment() : ""
        );
        log.info("Publishing work_order_created notification for workOrderId={}", workOrder.getId());
        kafkaTemplate.send(TOPIC, workOrder.getId(), payload);
    }
}
