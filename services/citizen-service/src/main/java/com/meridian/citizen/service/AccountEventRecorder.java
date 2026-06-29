package com.meridian.citizen.service;

import com.meridian.citizen.domain.AccountEvent;
import com.meridian.citizen.repository.AccountEventRepository;
import com.meridian.citizen.util.BusinessEventLogger;
import org.springframework.stereotype.Component;

/**
 * Records one account-creation lifecycle step at its real (possibly deferred) time: an
 * {@code account_events} row (powers the /analytics account funnel, which reads
 * {@code created_at}) plus a Business Event log line carrying {@code citizen.id} (powers the
 * "[Meridian] Account Creation" business flow). Shared by {@link CitizenService} (signup
 * burst) and {@link AccountLifecycleScheduler} (deferred verified/activated).
 */
@Component
public class AccountEventRecorder {

    private final AccountEventRepository accountEventRepository;
    private final BusinessEventLogger businessEventLogger;

    public AccountEventRecorder(AccountEventRepository accountEventRepository,
                                BusinessEventLogger businessEventLogger) {
        this.accountEventRepository = accountEventRepository;
        this.businessEventLogger = businessEventLogger;
    }

    public void record(String citizenId, String email, String eventType) {
        accountEventRepository.save(AccountEvent.of(citizenId, eventType));
        businessEventLogger.accountLifecycle(eventType, citizenId, email);
    }
}
