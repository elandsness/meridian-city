package com.meridian.billing.messaging;

import com.meridian.billing.domain.TaxBill;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Publishes tax lifecycle events to Kafka (billing.events). Consumed by
 * notification-service (per-citizen inbox). camelCase payloads (Java/Node convention).
 */
@Component
public class BillingEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(BillingEventPublisher.class);
    private static final String TOPIC = "billing.events";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public BillingEventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(String eventType, TaxBill bill) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", eventType);
        event.put("billId", bill.getId());
        event.put("citizenId", bill.getCitizenId());
        event.put("period", bill.getPeriod());
        event.put("amountCents", bill.getAmountCents());
        kafkaTemplate.send(TOPIC, bill.getId(), event).whenComplete((result, ex) -> {
            if (ex != null) {
                log.warn("Failed to publish billing event {} bill={}: {}", eventType, bill.getId(), ex.getMessage());
            } else {
                log.debug("Published billing event {} bill={}", eventType, bill.getId());
            }
        });
    }
}
