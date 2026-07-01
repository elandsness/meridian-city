package com.meridian.passenger.util;

import com.meridian.passenger.domain.Passenger;
import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits structured "BusinessEvents" JSON log lines that Dynatrace OpenPipeline
 * extracts into business events (correlation id = passenger.id). One event per
 * journey step powers the Passenger Journey Business Flow:
 * passenger.checked_in → [passenger.bag_checked] → passenger.security_cleared →
 * [passenger.bag_loaded] → passenger.boarded. Each event also carries flight.id so
 * a journey can be correlated with its departing flight (aircraft turnaround).
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void passengerStatus(Passenger p) {
        String eventType = "passenger." + p.getStatus();
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue("passenger.id", p.getId()),
                StructuredArguments.keyValue("passenger.booking_ref", p.getBookingRef()),
                StructuredArguments.keyValue("passenger.status", p.getStatus()),
                StructuredArguments.keyValue("passenger.has_bag", p.isHasBag()),
                StructuredArguments.keyValue("flight.id", p.getFlightId()),
                StructuredArguments.keyValue("flight.number", p.getFlightNumber()),
                StructuredArguments.keyValue("gate", p.getGate())
        );
    }
}
