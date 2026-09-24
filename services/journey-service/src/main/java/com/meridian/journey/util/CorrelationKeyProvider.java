package com.meridian.journey.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class CorrelationKeyProvider {

    @Value("${meridian.observability.correlation-keys:{journey:'journey.id', type:'entity.type', status:'journey.status', progress:'journey.progress'}}")
    private Map<String, String> keys;

    public String getJourneyKey() { return keys.getOrDefault("journey", "journey.id"); }
    public String getTypeKey() { return keys.getOrDefault("type", "entity.type"); }
    public String getStatusKey() { return keys.getOrDefault("status", "journey.status"); }
    public String getProgressKey() { return keys.getOrDefault("progress", "journey.progress"); }
}
