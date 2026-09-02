package com.meridian.transaction.messaging;

import com.meridian.transaction.domain.Bill;
import com.meridian.transaction.domain.Order;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Publishes transaction lifecycle events to Kafka (transaction.events). Consumed by
 * notification-service (per-citizen inbox) and analytics. camelCase payloads (Java/Node convention).
 */
@Component
public class TransactionEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(TransactionEventPublisher.class);
    private static final String TOPIC = "transaction.events";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public TransactionEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publishCartItemAdded(String cartId, String identityId, String productId, int quantity) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", "cart.item_added");
        event.put("cartId", cartId);
        event.put("identityId", identityId);
        event.put("productId", productId);
        event.put("quantity", quantity);
        send(cartId, event);
    }

    public void publishOrderEvent(String eventType, Order order) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", eventType);
        event.put("orderId", order.getId());
        event.put("identityId", order.getIdentityId());
        event.put("status", order.getStatus());
        event.put("totalCents", order.getTotalCents());
        event.put("itemCount", order.getItemCount());
        send(order.getId(), event);
    }

    public void publishBillEvent(String eventType, Bill bill) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", eventType);
        event.put("billId", bill.getId());
        event.put("identityId", bill.getIdentityId());
        event.put("period", bill.getPeriod());
        event.put("amountCents", bill.getAmountCents());
        send(bill.getId(), event);
    }

    private void send(String key, Map<String, Object> event) {
        kafkaTemplate.send(TOPIC, key, event).whenComplete((result, ex) -> {
            if (ex != null) {
                log.warn("Failed to publish transaction event {} key={}: {}",
                        event.get("eventType"), key, ex.getMessage());
            } else {
                log.debug("Published transaction event {} key={}", event.get("eventType"), key);
            }
        });
    }
}
