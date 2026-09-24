package com.meridian.identity.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class CorrelationKeyProvider {

    @Value("${meridian.observability.correlation-keys:{account:'account.id', identity:'identity.id'}}")
    private Map<String, String> keys;

    public String getAccountKey() { return keys.getOrDefault("account", "account.id"); }
    public String getIdentityKey() { return keys.getOrDefault("identity", "identity.id"); }
}
