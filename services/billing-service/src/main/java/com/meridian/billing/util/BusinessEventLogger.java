package com.meridian.billing.util;

import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Structured Business Events for the Tax Payment funnel (Flow E).
 * Discriminator key: "event.type" (see docs/INSTRUMENTATION.md).
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void taxBillIssued(String billId, String citizenId, String period, int amountCents) {
        BUSINESS_EVENTS.info("tax.bill_issued",
                StructuredArguments.keyValue("event.type", "tax.bill_issued"),
                StructuredArguments.keyValue("bill.id", billId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("bill.period", period),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }

    public void taxPaymentCompleted(String billId, String citizenId, int amountCents) {
        BUSINESS_EVENTS.info("tax.payment_completed",
                StructuredArguments.keyValue("event.type", "tax.payment_completed"),
                StructuredArguments.keyValue("bill.id", billId),
                StructuredArguments.keyValue("citizen.id", citizenId),
                StructuredArguments.keyValue("bill.amount_cents", amountCents)
        );
    }
}
