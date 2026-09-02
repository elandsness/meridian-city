package com.meridian.identity.web;

import com.meridian.identity.dto.CreateIdentityRequest;
import com.meridian.identity.dto.IdentityResponse;
import com.meridian.identity.service.IdentityService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/identity")
public class IdentityController {

    private final IdentityService identityService;

    public IdentityController(IdentityService identityService) {
        this.identityService = identityService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public IdentityResponse createIdentity(@RequestBody CreateIdentityRequest request) {
        return identityService.createIdentity(request);
    }

    @GetMapping("/{id}")
    public IdentityResponse findById(@PathVariable String id) {
        return identityService.findById(id);
    }
}
