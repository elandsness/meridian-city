package com.meridian.identity.service;

import com.meridian.identity.domain.Account;
import com.meridian.identity.domain.Identity;
import com.meridian.identity.dto.CreateIdentityRequest;
import com.meridian.identity.dto.IdentityResponse;
import com.meridian.identity.messaging.IdentityEventPublisher;
import com.meridian.identity.repository.AccountRepository;
import com.meridian.identity.repository.IdentityRepository;
import com.meridian.identity.util.BusinessEventLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;

@Service
public class IdentityService {

    private static final Logger log = LoggerFactory.getLogger(IdentityService.class);

    private final IdentityRepository identityRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final BusinessEventLogger businessEventLogger;
    private final IdentityEventPublisher identityEventPublisher;
    private final AccountEventRecorder accountEventRecorder;

    public IdentityService(IdentityRepository identityRepository,
                          AccountRepository accountRepository,
                          PasswordEncoder passwordEncoder,
                          BusinessEventLogger businessEventLogger,
                          IdentityEventPublisher identityEventPublisher,
                          AccountEventRecorder accountEventRecorder) {
        this.identityRepository = identityRepository;
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.businessEventLogger = businessEventLogger;
        this.identityEventPublisher = identityEventPublisher;
        this.accountEventRecorder = accountEventRecorder;
    }

    @Transactional
    public IdentityResponse createIdentity(CreateIdentityRequest request) {
        // Validate required fields up front. Without this, a null/blank value hits a
        // NOT NULL column constraint and surfaces as a 500 via the catch-all handler;
        // a bad request must map to 400 instead (see docs/API_CONVENTIONS.md §4).
        requireField(request.firstName(), "first_name");
        requireField(request.lastName(), "last_name");
        requireField(request.email(), "email");

        // email is UNIQUE; reject duplicates with 409 rather than letting the
        // constraint violation surface as a 500.
        identityRepository.findByEmail(request.email()).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
        });

        Identity identity = Identity.create(
                request.firstName(),
                request.lastName(),
                request.email(),
                request.zoneId()
        );

        // saveAndFlush so the identity row exists before the accounts FK insert
        // below (Account.identityId is a plain column, so Hibernate won't order
        // the inserts for the foreign key on its own).
        identity = identityRepository.saveAndFlush(identity);

        // Create a login account when a password was supplied. Optional so
        // non-interactive callers (traffic-bot) can still create identities.
        if (request.password() != null && !request.password().isBlank()) {
            Account account = Account.create(
                    identity.getId(), passwordEncoder.encode(request.password()));
            accountRepository.save(account);
            log.info("Login account created for identityId={}", identity.getId());
        }

        log.info("Identity created: identityId={} email={}", identity.getId(), identity.getEmail());
        businessEventLogger.identityRegistered(identity.getId(), identity.getEmail(), identity.getZoneId());

        // Emit the account-creation lifecycle (powers the account-creation funnel),
        // with a realistic drop-off at verification/activation.
        emitAccountLifecycle(identity);

        // Async seam: downstream services consume this to generate tax-bill history, etc.
        identityEventPublisher.publishIdentityRegistered(identity);

        return IdentityResponse.from(identity);
    }

    @Transactional(readOnly = true)
    public IdentityResponse findById(String id) {
        return identityRepository.findById(id)
                .map(IdentityResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Identity not found: " + id));
    }

    /**
     * Start the account-creation lifecycle. The signup burst (registration_started ->
     * details_submitted -> verification_sent) is emitted synchronously here — these happen
     * within seconds in real life (fill form, submit, system sends the verification email).
     * verified and activated are then deferred over realistic, randomized delays by the
     * {@link AccountLifecycleScheduler}, which also applies the verify/activate probabilities
     * so the funnel keeps its drop-off. Each step writes both an identity_events row and a
     * business-event log carrying identity.id.
     */
    private void emitAccountLifecycle(Identity identity) {
        String iid = identity.getId();
        String email = identity.getEmail();
        accountEventRecorder.record(iid, email, "account.registration_started");
        accountEventRecorder.record(iid, email, "account.details_submitted");
        accountEventRecorder.record(iid, email, "account.verification_sent");

        // Hand off to the scheduler: verified fires after the verified band elapses.
        identity.setAccountLifecycleStage("verification_sent");
        identity.setAccountNextTransitionAt(
                OffsetDateTime.now().plusSeconds(60)); // Default 1 minute delay
        identityRepository.save(identity);
    }

    private static void requireField(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }
}
