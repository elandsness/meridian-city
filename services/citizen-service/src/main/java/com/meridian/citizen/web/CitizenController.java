package com.meridian.citizen.web;

import com.meridian.citizen.dto.CitizenResponse;
import com.meridian.citizen.dto.CreateCitizenRequest;
import com.meridian.citizen.service.CitizenService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/citizens")
public class CitizenController {

    private final CitizenService citizenService;

    public CitizenController(CitizenService citizenService) {
        this.citizenService = citizenService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CitizenResponse createCitizen(@RequestBody CreateCitizenRequest request) {
        return citizenService.createCitizen(request);
    }

    @GetMapping("/{id}")
    public CitizenResponse findById(@PathVariable String id) {
        return citizenService.findById(id);
    }
}
