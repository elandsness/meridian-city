package com.meridian.dispatch.web;

import com.meridian.dispatch.dto.DispatchRequestDto;
import com.meridian.dispatch.dto.DispatchResultDto;
import com.meridian.dispatch.service.DispatchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/dispatch")
@RequiredArgsConstructor
public class DispatchController {

    private final DispatchService dispatchService;

    @PostMapping
    public ResponseEntity<DispatchResultDto> dispatch(@RequestBody DispatchRequestDto request) {
        log.info("Received dispatch request for requestId={}", request.getRequestId());
        DispatchResultDto result = dispatchService.dispatch(request);
        return ResponseEntity.ok(result);
    }
}
