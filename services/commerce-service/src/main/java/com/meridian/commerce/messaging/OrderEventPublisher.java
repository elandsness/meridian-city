package com.meridian.commerce.messaging;

import com.meridian.commerce.domain.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Publishes commerce lifecycle events to Kafka (commerce.events). Consumed by
 * notification-service (per-citizen inbox) and analytics. Payloads use camelCase
 * (Java/Node convention) — only the HTTP boundary is snake_case.
 */
@Component
public class OrderEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(OrderEventPublisher.class);
    private static final String TOPIC = "commerce.events";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public OrderEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishCartItemAdded(String cartId, String citizenId, String productId, int quantity) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", "cart.item_added");
        event.put("cartId", cartId);
        event.put("citizenId", citizenId);
        event.put("productId", productId);
        event.put("quantity", quantity);
        send(cartId, event);
    }

    public void publishOrderEvent(String eventType, Order order) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", eventType);
        event.put("orderId", order.getId());
        event.put("citizenId", order.getCitizenId());
        event.put("status", order.getStatus());
        event.put("totalCents", order.getTotalCents());
        event.put("itemCount", order.getItemCount());
        send(order.getId(), event);
    }

    private void send(String key, Map<String, Object> event) {
        kafkaTemplate.send(TOPIC, key, event).whenComplete((result, ex) -> {
            if (ex != null) {
                log.warn("Failed to publish commerce event {} key={}: {}",
                        event.get("eventType"), key, ex.getMessage());
            } else {
                log.debug("Published commerce event {} key={}", event.get("eventType"), key);
            }
        });
    }
}
