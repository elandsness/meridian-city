package com.meridian.journey;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Generic journey service — merges the former flight-ops and passenger-service into a
 * single configurable journey engine.
 *
 * <p>Same services, different skin: journey stages, transitions, and position
 * interpolation are driven by industry config rather than hardcoded domain concepts.
 * In an airport, this handles flights and passengers; in a hospital, it could handle
 * patient journeys; in a bank, loan processing journeys; etc.
 */
@SpringBootApplication
@EnableScheduling
public class JourneyServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(JourneyServiceApplication.class, args);
    }
}
