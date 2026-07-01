package com.meridian.flightops.util;

import com.meridian.flightops.domain.Flight;
import net.logstash.logback.argument.StructuredArguments;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Emits structured "BusinessEvents" JSON log lines that Dynatrace OpenPipeline
 * extracts into business events (correlation id = flight.id). One event per flight
 * status transition powers the Aircraft Turnaround Business Flow:
 * flight.at_gate → flight.servicing → flight.boarding → flight.taxiing → flight.takeoff.
 */
@Component
public class BusinessEventLogger {

    private static final Logger BUSINESS_EVENTS = LoggerFactory.getLogger("BusinessEvents");

    public void flightStatus(Flight f) {
        String eventType = "flight." + f.getStatus();
        BUSINESS_EVENTS.info(eventType,
                StructuredArguments.keyValue("event.type", eventType),
                StructuredArguments.keyValue("flight.id", f.getId()),
                StructuredArguments.keyValue("flight.number", f.getFlightNumber()),
                StructuredArguments.keyValue("flight.direction", f.getDirection()),
                StructuredArguments.keyValue("flight.airline", f.getAirline()),
                StructuredArguments.keyValue("flight.gate", f.getGate())
        );
    }
}
