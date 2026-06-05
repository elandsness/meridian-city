package com.meridian.citizen.web;

import com.meridian.citizen.domain.Citizen;
import com.meridian.citizen.repository.CitizenRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final CitizenRepository citizenRepository;

    public AuthController(CitizenRepository citizenRepository) {
        this.citizenRepository = citizenRepository;
    }

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> credentials) {
        String email = credentials.get("email");
        if (email == null || email.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "email is required");
        }

        Citizen citizen = citizenRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                        "Invalid credentials"));

        return Map.of(
                "citizenId", citizen.getId(),
                "email", citizen.getEmail(),
                "name", citizen.getFirstName() + " " + citizen.getLastName()
        );
    }
}
