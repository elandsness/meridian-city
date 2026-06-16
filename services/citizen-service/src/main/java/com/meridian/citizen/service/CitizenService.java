package com.meridian.citizen.service;

import com.meridian.citizen.domain.Account;
import com.meridian.citizen.domain.Citizen;
import com.meridian.citizen.dto.CitizenResponse;
import com.meridian.citizen.dto.CreateCitizenRequest;
import com.meridian.citizen.messaging.CitizenEventPublisher;
import com.meridian.citizen.repository.AccountRepository;
import com.meridian.citizen.repository.CitizenRepository;
import com.meridian.citizen.util.BusinessEventLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CitizenService {

    private static final Logger log = LoggerFactory.getLogger(CitizenService.class);

    private final CitizenRepository citizenRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final BusinessEventLogger businessEventLogger;
    private final CitizenEventPublisher citizenEventPublisher;

    public CitizenService(CitizenRepository citizenRepository,
                          AccountRepository accountRepository,
                          PasswordEncoder passwordEncoder,
                          BusinessEventLogger businessEventLogger,
                          CitizenEventPublisher citizenEventPublisher) {
        this.citizenRepository = citizenRepository;
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
        this.businessEventLogger = businessEventLogger;
        this.citizenEventPublisher = citizenEventPublisher;
    }

    @Transactional
    public CitizenResponse createCitizen(CreateCitizenRequest request) {
        // Validate required fields up front. Without this, a null/blank value hits a
        // NOT NULL column constraint and surfaces as a 500 via the catch-all handler;
        // a bad request must map to 400 instead (see docs/API_CONVENTIONS.md §4).
        requireField(request.firstName(), "first_name");
        requireField(request.lastName(), "last_name");
        requireField(request.email(), "email");

        // email is UNIQUE; reject duplicates with 409 rather than letting the
        // constraint violation surface as a 500.
        citizenRepository.findByEmail(request.email()).ifPresent(existing -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "email already registered");
        });

        Citizen citizen = Citizen.create(
                request.firstName(),
                request.lastName(),
                request.email(),
                request.zoneId()
        );

        // saveAndFlush so the citizen row exists before the accounts FK insert
        // below (Account.citizenId is a plain column, so Hibernate won't order
        // the inserts for the foreign key on its own).
        citizen = citizenRepository.saveAndFlush(citizen);

        // Create a login account when a password was supplied. Optional so
        // non-interactive callers (traffic-bot) can still create citizens.
        if (request.password() != null && !request.password().isBlank()) {
            Account account = Account.create(
                    citizen.getId(), passwordEncoder.encode(request.password()));
            accountRepository.save(account);
            log.info("Login account created for citizenId={}", citizen.getId());
        }

        log.info("Citizen created: citizenId={} email={}", citizen.getId(), citizen.getEmail());
        businessEventLogger.citizenRegistered(citizen.getId(), citizen.getEmail(), citizen.getZoneId());

        // Async seam: billing-service consumes this to generate a tax-bill history.
        citizenEventPublisher.publishCitizenRegistered(citizen);

        return CitizenResponse.from(citizen);
    }

    @Transactional(readOnly = true)
    public CitizenResponse findById(String id) {
        return citizenRepository.findById(id)
                .map(CitizenResponse::from)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Citizen not found: " + id));
    }

    private static void requireField(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, name + " is required");
        }
    }
}
