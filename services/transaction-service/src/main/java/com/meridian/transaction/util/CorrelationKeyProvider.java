package com.meridian.transaction.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.util.Map;

@Component
public class CorrelationKeyProvider {

    @Value("${meridian.observability.correlation-keys:{cart:'cart.id', order:'order.id', bill:'bill.id', identity:'identity.id'}}")
    private Map<String, String> keys;

    public String getCartKey() { return keys.getOrDefault("cart", "cart.id"); }
    public String getOrderKey() { return keys.getOrDefault("order", "order.id"); }
    public String getBillKey() { return keys.getOrDefault("bill", "bill.id"); }
    public String getIdentityKey() { return keys.getOrDefault("identity", "identity.id"); }
}
