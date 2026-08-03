package com.meridian.entityengine.web;

import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.repository.EntityRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Generic replacement for citizen-service's AuthController -- verified (Stage 6
 * research) that Airport has zero dependency on citizen-service beyond this one
 * endpoint, so api-gateway's auth.js dispatcher can repoint CITIZEN_SERVICE_URL
 * at whichever entity-engine deployment owns the "citizen" entity type
 * (customer-entity-service) without touching anything Airport-side.
 *
 * <p>Fixed convention (only active/meaningful on a deployment whose mounted
 * entity-config includes a "citizen" entity type): entity type "citizen",
 * field "email" (matched case-insensitively) and field "password" (a FieldDef
 * of type "password", BCrypt-hashed on write by EntityFactory). All failure
 * modes collapse to one generic 401 to avoid email enumeration, same as the
 * service this replaces. Known simplification vs. the legacy service: no
 * duplicate-email 409 check (a demo-only citizen-facing register path, not a
 * production auth system) -- a duplicate email would match whichever row
 * happens to come first in the lookup, not fail loudly.
 */
@RestController
@RequiredArgsConstructor
public class AuthController {

    private static final String ENTITY_TYPE = "citizen";

    private final EntityRecordRepository repository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @PostMapping("/api/v1/auth/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body) {
        String email = body == null ? null : body.get("email");
        String password = body == null ? null : body.get("password");

        EntityRecord citizen = email == null ? null : repository.findByEntityType(ENTITY_TYPE).stream()
                .filter(r -> email.equalsIgnoreCase(String.valueOf(r.getField("email"))))
                .findFirst()
                .orElse(null);

        Object storedHash = citizen == null ? null : citizen.getField("password");
        if (citizen == null || storedHash == null || password == null || !passwordEncoder.matches(password, String.valueOf(storedHash))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        return Map.of(
                "citizen_id", citizen.getId(),
                "email", String.valueOf(citizen.getField("email")),
                "name", (citizen.getField("first_name") + " " + citizen.getField("last_name")).trim()
        );
    }
}
