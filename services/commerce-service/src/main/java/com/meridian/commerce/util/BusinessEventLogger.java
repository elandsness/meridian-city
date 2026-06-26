package com.meridian.commerce.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits structured Business Events that Dynatrace extracts from the log stream.
 * All events use "event.type" as the discriminator key (see docs/INSTRUMENTATION.md).
 * These feed the City Store Purchase funnel (Flow D).
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void cartItemAdded(String cartId, String citizenId, String productId, int quantity) {
        BUSINESS_EVENTS.info("cart.item_added",
                StructuredArguments.keyValue("event.type", "cart.item_added"),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("product.id", productId),
                StructuredArguments.keyValue("quantity", quantity)
        );
    }

    public void checkoutCompleted(String orderId, String cartId, String citizenId,
                                  int totalCents, int itemCount) {
        BUSINESS_EVENTS.info("checkout.completed",
                StructuredArguments.keyValue("event.type", "checkout.completed"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("order.total_cents", totalCents),
                StructuredArguments.keyValue("order.item_count", itemCount)
        );
    }

    public void orderPacked(String orderId, String cartId, String citizenId) {
        BUSINESS_EVENTS.info("order.packed",
                StructuredArguments.keyValue("event.type", "order.packed"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("citizen.id", citizenId)
        );
    }

    public void orderShipped(String orderId, String cartId, String citizenId, String carrier) {
        BUSINESS_EVENTS.info("order.shipped",
                StructuredArguments.keyValue("event.type", "order.shipped"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("carrier", carrier)
        );
    }

    public void orderDelivered(String orderId, String cartId, String citizenId) {
        BUSINESS_EVENTS.info("order.delivered",
                StructuredArguments.keyValue("event.type", "order.delivered"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("citizen.id", citizenId)
        );
    }
}
