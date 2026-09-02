package com.meridian.identity.service;

import com.meridian.identity.domain.IdentityEvent;
import com.meridian.identity.repository.IdentityEventRepository;
import com.meridian.identity.util.BusinessEventLogger;
import org.springframework.stereotype.Component;

/**
 * Records one account-creation lifecycle step at its real (possibly deferred) time: an
 * {@code identity_events} row (powers the /analytics account funnel, which reads
 * {@code created_at}) plus a Business Event log line carrying {@code identity.id} (powers the
 * "[Meridian] Account Creation" business flow). Shared by {@link IdentityService} (signup
 * burst) and {@link AccountLifecycleScheduler} (deferred verified/activated).
 */
@Component
public class AccountEventRecorder {

    private final IdentityEventRepository identityEventRepository;
    private final BusinessEventLogger businessEventLogger;

    public AccountEventRecorder(IdentityEventRepository identityEventRepository,
                                BusinessEventLogger businessEventLogger) {
        this.identityEventRepository = identityEventRepository;
        this.businessEventLogger = businessEventLogger;
    }

    public void record(String identityId, String email, String eventType) {
        identityEventRepository.save(IdentityEvent.of(identityId, eventType));
        businessEventLogger.accountLifecycle(eventType, identityId, email);
    }
}
