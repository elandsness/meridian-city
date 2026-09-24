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
@Value("${meridian.observability.entity-types.cart:cart}") private String cartType;
@Value("${meridian.observability.entity-types.order:order}") private String orderType;
@Value("${meridian.observability.entity-types.bill:bill}") private String billType;
@Value("${meridian.observability.entity-types.identity:identity}") private String identityType;

    // Cart events
    public void cartItemAdded(String cartId, String identityId, String productId, int quantity) {
        String eventType = "cart.item_added";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(cartType + ".id", cartId),
                StructuredArguments.keyValue(identityType + ".id", identityId),
                StructuredArguments.keyValue("product.id", productId),
                StructuredArguments.keyValue("cart.item_quantity", quantity)
        );
    }

    // Checkout events
    public void checkoutCompleted(String orderId, String cartId, String identityId, int totalCents, int itemCount) {
        String eventType = "order.checkout_completed";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(orderType + ".id", orderId),
                StructuredArguments.keyValue(cartType + ".id", cartId),
                StructuredArguments.keyValue(identityType + ".id", identityId),
                StructuredArguments.keyValue("checkout.total_cents", totalCents),
                StructuredArguments.keyValue("checkout.item_count", itemCount)
        );
    }

    public void checkoutPaymentFailed(String cartId, String identityId, int totalCents, int itemCount) {
        String eventType = "cart.payment_failed";
        BUSINESS_EVENTS.warn(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(cartType + ".id", cartId),
                StructuredArguments.keyValue(identityType + ".id", identityId),
                StructuredArguments.keyValue("checkout.total_cents", totalCents),
                StructuredArguments.keyValue("checkout.item_count", itemCount)
        );
    }

    // Order fulfillment events
    public void orderPacked(String orderId, String cartId, String identityId) {
        String eventType = "order.packed";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(orderType + ".id", orderId),
                StructuredArguments.keyValue(cartType + ".id", cartId),
                StructuredArguments.keyValue(identityType + ".id", identityId)
        );
    }

    public void orderShipped(String orderId, String cartId, String identityId, String carrier) {
        String eventType = "order.shipped";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(orderType + ".id", orderId),
                StructuredArguments.keyValue(cartType + ".id", cartId),
                StructuredArguments.keyValue(identityType + ".id", identityId),
                StructuredArguments.keyValue("order.carrier", carrier)
        );
    }

    public void orderDelivered(String orderId, String cartId, String identityId) {
        String eventType = "order.delivered";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(orderType + ".id", orderId),
                StructuredArguments.keyValue(cartType + ".id", cartId),
                StructuredArguments.keyValue(identityType + ".id", identityId)
        );
    }

    // Bill events
    public void billIssued(String billId, String identityId, String period, int amountCents) {
        String eventType = "bill.issued";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(billType + ".id", billId),
                StructuredArguments.keyValue(identityType + ".id", identityId),
                StructuredArguments.keyValue("bill.period", period),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }

    public void billPaymentCompleted(String billId, String identityId, int amountCents) {
        String eventType = "bill.payment_completed";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(billType + ".id", billId),
                StructuredArguments.keyValue(identityType + ".id", identityId),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }

    public void billPaymentFailed(String billId, String identityId, int amountCents) {
        String eventType = "bill.payment_failed";
        BUSINESS_EVENTS.warn(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(billType + ".id", billId),
                StructuredArguments.keyValue(identityType + ".id", identityId),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }
}
