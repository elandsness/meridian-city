package com.meridian.citizen.service;

import com.meridian.citizen.domain.Citizen;
import com.meridian.citizen.dto.CitizenResponse;
import com.meridian.citizen.dto.CreateCitizenRequest;
import com.meridian.citizen.repository.CitizenRepository;
import com.meridian.citizen.util.BusinessEventLogger;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CitizenService {

    private static final Logger log = LoggerFactory.getLogger(CitizenService.class);

    private final CitizenRepository citizenRepository;
    private final BusinessEventLogger businessEventLogger;

    public CitizenService(CitizenRepository citizenRepository,
                          BusinessEventLogger businessEventLogger) {
        this.citizenRepository = citizenRepository;
        this.businessEventLogger = businessEventLogger;
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

        citizen = citizenRepository.save(citizen);

        log.info("Citizen created: citizenId={} email={}", citizen.getId(), citizen.getEmail());
        businessEventLogger.citizenRegistered(citizen.getId(), citizen.getEmail(), citizen.getZoneId());

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
