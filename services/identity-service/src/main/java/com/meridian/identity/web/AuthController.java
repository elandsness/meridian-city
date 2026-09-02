package com.meridian.identity.web;

import com.meridian.identity.domain.Account;
import com.meridian.identity.domain.Identity;
import com.meridian.identity.repository.AccountRepository;
import com.meridian.identity.repository.IdentityRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Identity credential verification, called by the api-gateway's /api/v1/auth/login
 * dispatcher (which handles the built-in demo/dynatrace operator login itself and
 * delegates everything else here). Verifies email + BCrypt password against the
 * identity's account and returns the identity identity on success.
 *
 * Not exposed through the gateway directly — the gateway intercepts
 * /api/v1/auth/login and calls this internally.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final IdentityRepository identityRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(IdentityRepository identityRepository,
                         AccountRepository accountRepository,
                         PasswordEncoder passwordEncoder) {
        this.identityRepository = identityRepository;
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

        // Generic 401 for every failure mode (no such identity / no account /
        // inactive / wrong password) so we don't leak which emails are registered.
        ResponseStatusException unauthorized =
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");

        Identity identity = identityRepository.findByEmail(email).orElseThrow(() -> unauthorized);

        Account account = accountRepository.findByIdentityId(identity.getId())
                .filter(a -> Boolean.TRUE.equals(a.getIsActive()))
                .orElseThrow(() -> unauthorized);

        if (!passwordEncoder.matches(password, account.getPasswordHash())) {
            throw unauthorized;
        }

        // snake_case keys consumed by the gateway dispatcher.
        return Map.of(
                "identity_id", identity.getId(),
                "email", identity.getEmail(),
                "name", identity.getFirstName() + " " + identity.getLastName()
        );
    }
}
