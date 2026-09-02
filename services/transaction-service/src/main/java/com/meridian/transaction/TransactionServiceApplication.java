package com.meridian.transaction;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Generic transaction service — merges the former commerce-service (carts, orders,
 * fulfillment) and billing-service (tax bills, payment processing) into a single
 * configurable transaction engine.
 *
 * <p>Same services, different skin: order fulfillment state machine, bill generation
 * rules, and payment processing are driven by industry config rather than hardcoded
 * domain concepts.
 */
@SpringBootApplication
@EnableScheduling
public class TransactionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(TransactionServiceApplication.class, args);
    }
}
