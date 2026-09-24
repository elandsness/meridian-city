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
    private final CorrelationKeyProvider keys;

    public BusinessEventLogger(CorrelationKeyProvider keys) {
        this.keys = keys;
    }

    // Cart events
    public void cartItemAdded(String cartId, String identityId, String productId, int quantity) {
        String eventType = "cart.item_added";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getCartKey(), cartId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId),
                StructuredArguments.keyValue("product.id", productId),
                StructuredArguments.keyValue("cart.item_quantity", quantity)
        );
    }

    // Checkout events
    public void checkoutCompleted(String orderId, String cartId, String identityId, int totalCents, int itemCount) {
        String eventType = "order.checkout_completed";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getOrderKey(), orderId),
                StructuredArguments.keyValue(keys.getCartKey(), cartId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId),
                StructuredArguments.keyValue("checkout.total_cents", totalCents),
                StructuredArguments.keyValue("checkout.item_count", itemCount)
        );
    }

    public void checkoutPaymentFailed(String cartId, String identityId, int totalCents, int itemCount) {
        String eventType = "cart.payment_failed";
        BUSINESS_EVENTS.warn(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getCartKey(), cartId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId),
                StructuredArguments.keyValue("checkout.total_cents", totalCents),
                StructuredArguments.keyValue("checkout.item_count", itemCount)
        );
    }

    // Order fulfillment events
    public void orderPacked(String orderId, String cartId, String identityId) {
        String eventType = "order.packed";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getOrderKey(), orderId),
                StructuredArguments.keyValue(keys.getCartKey(), cartId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId)
        );
    }

    public void orderShipped(String orderId, String cartId, String identityId, String carrier) {
        String eventType = "order.shipped";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getOrderKey(), orderId),
                StructuredArguments.keyValue(keys.getCartKey(), cartId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId),
                StructuredArguments.keyValue("order.carrier", carrier)
        );
    }

    public void orderDelivered(String orderId, String cartId, String identityId) {
        String eventType = "order.delivered";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getOrderKey(), orderId),
                StructuredArguments.keyValue(keys.getCartKey(), cartId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId)
        );
    }

    // Bill events
    public void billIssued(String billId, String identityId, String period, int amountCents) {
        String eventType = "bill.issued";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getBillKey(), billId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId),
                StructuredArguments.keyValue("bill.period", period),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }

    public void billPaymentCompleted(String billId, String identityId, int amountCents) {
        String eventType = "bill.payment_completed";
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getBillKey(), billId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }

    public void billPaymentFailed(String billId, String identityId, int amountCents) {
        String eventType = "bill.payment_failed";
        BUSINESS_EVENTS.warn(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue(keys.getBillKey(), billId),
                StructuredArguments.keyValue(keys.getIdentityKey(), identityId),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }
}
