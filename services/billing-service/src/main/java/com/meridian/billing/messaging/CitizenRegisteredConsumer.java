package com.meridian.billing.messaging;

import com.meridian.billing.service.BillGenerationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Generates a citizen's tax-bill history when they register. Consumes the
 * citizen.registered event citizen-service publishes to citizens.events — an
 * asynchronous seam that keeps registration latency independent of billing.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CitizenRegisteredConsumer {

    private final BillGenerationService billGenerationService;

    @KafkaListener(topics = "citizens.events", containerFactory = "citizensKafkaListenerContainerFactory")
    public void onCitizenEvent(Map<String, Object> payload) {
        String eventType = str(payload, "eventType");
        if (!"citizen.registered".equals(eventType)) {
            return;
        }
        String citizenId = str(payload, "citizenId");
        if (citizenId == null || citizenId.isBlank()) {
            log.warn("citizen.registered event missing citizenId: {}", payload);
            return;
        }
        log.info("Generating tax bills for newly registered citizen={}", citizenId);
        billGenerationService.generateForCitizen(citizenId);
    }

    private String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v != null ? v.toString() : null;
    }
}
