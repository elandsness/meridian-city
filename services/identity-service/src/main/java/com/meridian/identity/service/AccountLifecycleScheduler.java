package com.meridian.identity.service;

import com.meridian.identity.domain.Identity;
import com.meridian.identity.repository.IdentityRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Defers the back half of the account-creation flow so verified/activated land at realistic,
 * randomized times after the synchronous signup burst. Polls identities on
 * (account_lifecycle_stage, account_next_transition_at):
 * verification_sent -> verified -> activated, with the verify/activate probabilities leaving a
 * realistic drop-off (abandoned / verified_only terminals). Each emitted step writes the
 * identity_events row + business-event log at its real time, so the /analytics funnel and the
 * "[Meridian] Account Creation" business flow both restage correctly on identity.id.
 */
@Component
public class AccountLifecycleScheduler {

    private static final Logger log = LoggerFactory.getLogger(AccountLifecycleScheduler.class);

    private final IdentityRepository identityRepository;
    private final AccountEventRecorder accountEventRecorder;

    public AccountLifecycleScheduler(IdentityRepository identityRepository,
                                     AccountEventRecorder accountEventRecorder) {
        this.identityRepository = identityRepository;
        this.accountEventRecorder = accountEventRecorder;
    }

    @Scheduled(fixedDelay = 5_000)
    @Transactional
    public void advanceIdentities() {
        OffsetDateTime now = OffsetDateTime.now();
        List<Identity> due = identityRepository
                .findByAccountLifecycleStageInAndAccountNextTransitionAtLessThanEqual(
                        List.of("verification_sent", "verified"), now);
        for (Identity identity : due) {
            try {
                advance(identity, now);
            } catch (RuntimeException ex) {
                log.warn("Account lifecycle advance failed for identityId={}: {}",
                        identity.getId(), ex.getMessage());
            }
        }
    }

    private void advance(Identity identity, OffsetDateTime now) {
        switch (identity.getAccountLifecycleStage()) {
            case "verification_sent" -> {
                // 85% probability of verification success
                if (ThreadLocalRandom.current().nextDouble() <= 0.85) {
                    accountEventRecorder.record(identity.getId(), identity.getEmail(), "account.verified");
                    identity.setAccountLifecycleStage("verified");
                    identity.setAccountNextTransitionAt(now.plusSeconds(300)); // 5 minutes
                } else {
                    // Never verifies (funnel drop-off).
                    identity.setAccountLifecycleStage("abandoned");
                    identity.setAccountNextTransitionAt(null);
                }
                identityRepository.save(identity);
            }
            case "verified" -> {
                // 92% probability of activation success
                if (ThreadLocalRandom.current().nextDouble() <= 0.92) {
                    accountEventRecorder.record(identity.getId(), identity.getEmail(), "account.activated");
                    identity.setAccountLifecycleStage("activated");
                } else {
                    // Verified but never activates (funnel drop-off).
                    identity.setAccountLifecycleStage("verified_only");
                }
                identity.setAccountNextTransitionAt(null);
                identityRepository.save(identity);
            }
            default -> { /* terminal or unknown stage — nothing to do */ }
        }
    }
}
