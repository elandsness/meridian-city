package com.meridian.citizen.service;

import com.meridian.citizen.config.AccountLifecycleProperties;
import com.meridian.citizen.config.FaultState;
import com.meridian.citizen.domain.Citizen;
import com.meridian.citizen.repository.CitizenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Defers the back half of the account-creation flow so verified/activated land at realistic,
 * randomized times after the synchronous signup burst (see {@link AccountLifecycleProperties}).
 * Polls citizens on (account_lifecycle_stage, account_next_transition_at):
 * verification_sent -> verified -> activated, with the verify/activate probabilities leaving a
 * realistic drop-off (abandoned / verified_only terminals). Each emitted step writes the
 * account_events row + business-event log at its real time, so the /analytics funnel and the
 * "[Meridian] Account Creation" business flow both restage correctly on citizen.id.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AccountLifecycleScheduler {

    private final CitizenRepository citizenRepository;
    private final AccountEventRecorder accountEventRecorder;
    private final AccountLifecycleProperties props;
    private final FaultState faultState;

    @Scheduled(fixedDelay = 5_000)
    @Transactional
    public void advanceAccounts() {
        if (!props.isEnabled()) {
            return;
        }
        OffsetDateTime now = OffsetDateTime.now();
        List<Citizen> due = citizenRepository
                .findByAccountLifecycleStageInAndAccountNextTransitionAtLessThanEqual(
                        List.of("verification_sent", "verified"), now);
        for (Citizen citizen : due) {
            try {
                advance(citizen, now);
            } catch (RuntimeException ex) {
                log.warn("Account lifecycle advance failed for citizenId={}: {}",
                        citizen.getId(), ex.getMessage());
            }
        }
    }

    private void advance(Citizen citizen, OffsetDateTime now) {
        switch (citizen.getAccountLifecycleStage()) {
            case "verification_sent" -> {
                if (failNow()) {
                    // Business-exception (gated): explicit verification failure (e.g. KYC /
                    // email check) — an error branch + drop-off at the Verified step.
                    accountEventRecorder.record(
                            citizen.getId(), citizen.getEmail(), "account.verification_failed");
                    citizen.setAccountLifecycleStage("verification_failed");
                    citizen.setAccountNextTransitionAt(null);
                } else if (ThreadLocalRandom.current().nextDouble() <= props.getVerifyProbability()) {
                    accountEventRecorder.record(citizen.getId(), citizen.getEmail(), "account.verified");
                    citizen.setAccountLifecycleStage("verified");
                    citizen.setAccountNextTransitionAt(now.plusSeconds(props.nextActivatedDelaySeconds()));
                } else {
                    // Never verifies (funnel drop-off).
                    citizen.setAccountLifecycleStage("abandoned");
                    citizen.setAccountNextTransitionAt(null);
                }
                citizenRepository.save(citizen);
            }
            case "verified" -> {
                if (failNow()) {
                    // Business-exception (gated): activation failure (e.g. failed fraud
                    // check) — an error branch + drop-off at the Activated step.
                    accountEventRecorder.record(
                            citizen.getId(), citizen.getEmail(), "account.activation_failed");
                    citizen.setAccountLifecycleStage("activation_failed");
                } else if (ThreadLocalRandom.current().nextDouble() <= props.getActivateProbability()) {
                    accountEventRecorder.record(citizen.getId(), citizen.getEmail(), "account.activated");
                    citizen.setAccountLifecycleStage("activated");
                } else {
                    // Verified but never activates (funnel drop-off).
                    citizen.setAccountLifecycleStage("verified_only");
                }
                citizen.setAccountNextTransitionAt(null);
                citizenRepository.save(citizen);
            }
            default -> { /* terminal or unknown stage — nothing to do */ }
        }
    }

    /** True when the account-failure fault is on and this transition draws a failure. */
    private boolean failNow() {
        return faultState.isAccountFailEnabled()
                && ThreadLocalRandom.current().nextDouble() < faultState.getAccountFailRate();
    }
}
