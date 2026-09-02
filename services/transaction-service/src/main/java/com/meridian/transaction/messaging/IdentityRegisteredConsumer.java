package com.meridian.transaction.messaging;

import com.meridian.transaction.service.BillGenerationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Generates an identity's bill history when they register. Consumes the
 * identity.registered event identity-service publishes to identity.events — an
 * asynchronous seam that keeps registration latency independent of billing.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IdentityRegisteredConsumer {

    private final BillGenerationService billGenerationService;

    @KafkaListener(topics = "identity.events", containerFactory = "transactionKafkaListenerContainerFactory")
    public void onIdentityEvent(Map<String, Object> payload) {
        String eventType = str(payload, "eventType");
        if (!"identity.registered".equals(eventType)) {
            return;
        }
        String identityId = str(payload, "identityId");
        if (identityId == null || identityId.isBlank()) {
            log.warn("identity.registered event missing identityId: {}", payload);
            return;
        }
        log.info("Generating bills for newly registered identity={}", identityId);
        billGenerationService.generateForIdentity(identityId);
    }

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v != null ? v.toString() : null;
    }
}
