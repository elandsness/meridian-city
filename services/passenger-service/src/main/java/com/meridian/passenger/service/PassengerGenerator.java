package com.meridian.passenger.service;

import com.meridian.passenger.repository.PassengerRepository;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps a steady, always-on stream of passengers checking in and moving through the
 * journey, up to a configurable in-progress cap. Passenger creation (flight linkage,
 * seat, booking ref) lives in {@link PassengerService#spawn}, shared with the personal
 * "my journey" endpoint.
 */
@Component
@Slf4j
public class PassengerGenerator {

    private static final List<String> TERMINAL = List.of("boarded");

    private static final String[] FIRST = {
        "Ava", "Liam", "Noah", "Emma", "Olivia", "Sofia", "Kai", "Mateo",
        "Priya", "Wei", "Fatima", "Diego", "Lena", "Omar", "Chloe", "Yuki"
    };
    private static final String[] LAST = {
        "Nguyen", "Patel", "Garcia", "Kim", "Johnson", "Silva", "Haddad",
        "Muller", "Rossi", "Okafor", "Tanaka", "Novak", "Reyes", "Andersson"
    };

    private final PassengerRepository repository;
    private final PassengerService passengerService;
    private final double bagProbability;
    private final boolean enabled;
    private final int maxActive;

    public PassengerGenerator(PassengerRepository repository,
                              PassengerService passengerService,
                              @Value("${passenger-generator.bag-probability:0.6}") double bagProbability,
                              @Value("${passenger-generator.enabled:true}") boolean enabled,
                              @Value("${passenger-generator.max-active:40}") int maxActive) {
        this.repository = repository;
        this.passengerService = passengerService;
        this.bagProbability = bagProbability;
        this.enabled = enabled;
        this.maxActive = maxActive;
    }

    @Scheduled(fixedDelayString = "${passenger-generator.interval-ms:15000}")
    public void generate() {
        if (!enabled) {
            return;
        }
        long active = repository.countByStatusNotIn(TERMINAL);
        if (active >= maxActive) {
            return;
        }
        int toCreate = Math.min(3, maxActive - (int) active);
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        for (int i = 0; i < toCreate; i++) {
            String name = FIRST[rnd.nextInt(FIRST.length)] + " " + LAST[rnd.nextInt(LAST.length)];
            boolean hasBag = rnd.nextDouble() < bagProbability;
            passengerService.spawn(name, hasBag, null);
        }
    }
}
