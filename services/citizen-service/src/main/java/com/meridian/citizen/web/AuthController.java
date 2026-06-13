package com.meridian.citizen.web;

import com.meridian.citizen.domain.Account;
import com.meridian.citizen.domain.Citizen;
import com.meridian.citizen.repository.AccountRepository;
import com.meridian.citizen.repository.CitizenRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Citizen credential verification, called by the api-gateway's /api/v1/auth/login
 * dispatcher (which handles the built-in demo/dynatrace operator login itself and
 * delegates everything else here). Verifies email + BCrypt password against the
 * citizen's account and returns the citizen identity on success.
 *
 * Not exposed through the gateway directly — the gateway intercepts
 * /api/v1/auth/login and calls this internally.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final CitizenRepository citizenRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(CitizenRepository citizenRepository,
                         AccountRepository accountRepository,
                         PasswordEncoder passwordEncoder) {
        this.citizenRepository = citizenRepository;
        this.accountRepository = accountRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        String password = credentials.get("password");
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email and password are required");
        }

        // Generic 401 for every failure mode (no such citizen / no account /
        // inactive / wrong password) so we don't leak which emails are registered.
        ResponseStatusException unauthorized =
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");

        Citizen citizen = citizenRepository.findByEmail(email).orElseThrow(() -> unauthorized);

        Account account = accountRepository.findByCitizenId(citizen.getId())
                .filter(a -> Boolean.TRUE.equals(a.getIsActive()))
                .orElseThrow(() -> unauthorized);

        if (!passwordEncoder.matches(password, account.getPasswordHash())) {
            throw unauthorized;
        }

        // snake_case keys consumed by the gateway dispatcher.
        return Map.of(
                "citizen_id", citizen.getId(),
                "email", citizen.getEmail(),
                "name", citizen.getFirstName() + " " + citizen.getLastName()
        );
    }
}
