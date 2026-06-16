package com.meridian.commerce.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/** Timer offsets (seconds) for the simulated order lifecycle. */
@Component
@ConfigurationProperties(prefix = "fulfillment")
@Data
public class FulfillmentProperties {
    private long packedAfterSeconds = 20;
    private long shippedAfterSeconds = 30;
    private long deliveredAfterSeconds = 40;
}
