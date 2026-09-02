package com.meridian.transaction.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Structured Business Events for the Transaction funnels.
 * Discriminator key: "event.type" (see docs/INSTRUMENTATION.md).
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    // Cart events
    public void cartItemAdded(String cartId, String identityId, String productId, int quantity) {
        BUSINESS_EVENTS.info("cart.item_added",
                StructuredArguments.keyValue("event.type", "cart.item_added"),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("product.id", productId),
                StructuredArguments.keyValue("cart.item_quantity", quantity)
        );
    }

    // Checkout events
    public void checkoutCompleted(String orderId, String cartId, String identityId, int totalCents, int itemCount) {
        BUSINESS_EVENTS.info("checkout.completed",
                StructuredArguments.keyValue("event.type", "checkout.completed"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("checkout.total_cents", totalCents),
                StructuredArguments.keyValue("checkout.item_count", itemCount)
        );
    }

    public void checkoutPaymentFailed(String cartId, String identityId, int totalCents, int itemCount) {
        BUSINESS_EVENTS.warn("checkout.payment_failed",
                StructuredArguments.keyValue("event.type", "checkout.payment_failed"),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("checkout.total_cents", totalCents),
                StructuredArguments.keyValue("checkout.item_count", itemCount)
        );
    }

    // Order fulfillment events
    public void orderPacked(String orderId, String cartId, String identityId) {
        BUSINESS_EVENTS.info("order.packed",
                StructuredArguments.keyValue("event.type", "order.packed"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("identity.id", identityId)
        );
    }

    public void orderShipped(String orderId, String cartId, String identityId, String carrier) {
        BUSINESS_EVENTS.info("order.shipped",
                StructuredArguments.keyValue("event.type", "order.shipped"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("order.carrier", carrier)
        );
    }

    public void orderDelivered(String orderId, String cartId, String identityId) {
        BUSINESS_EVENTS.info("order.delivered",
                StructuredArguments.keyValue("event.type", "order.delivered"),
                StructuredArguments.keyValue("order.id", orderId),
                StructuredArguments.keyValue("cart.id", cartId),
                StructuredArguments.keyValue("identity.id", identityId)
        );
    }

    // Bill events
    public void billIssued(String billId, String identityId, String period, int amountCents) {
        BUSINESS_EVENTS.info("bill.issued",
                StructuredArguments.keyValue("event.type", "bill.issued"),
                StructuredArguments.keyValue("bill.id", billId),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("bill.period", period),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }

    public void billPaymentCompleted(String billId, String identityId, int amountCents) {
        BUSINESS_EVENTS.info("bill.payment_completed",
                StructuredArguments.keyValue("event.type", "bill.payment_completed"),
                StructuredArguments.keyValue("bill.id", billId),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }

    public void billPaymentFailed(String billId, String identityId, int amountCents) {
        BUSINESS_EVENTS.warn("bill.payment_failed",
                StructuredArguments.keyValue("event.type", "bill.payment_failed"),
                StructuredArguments.keyValue("bill.id", billId),
                StructuredArguments.keyValue("identity.id", identityId),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }
}
