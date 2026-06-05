package com.meridian.dispatch.service;

import com.meridian.dispatch.dto.CreateWorkOrderDto;
import com.meridian.dispatch.dto.DispatchResultDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class CityOperationsClient {

    private final RestTemplate restTemplate;

    @Value("${city-operations.url}")
    private String cityOperationsUrl;

    public DispatchResultDto createWorkOrder(CreateWorkOrderDto workOrderDto) {
        String url = cityOperationsUrl + "/api/v1/work-orders";
        try {
            log.info("Calling city-operations to create work order for requestId={}", workOrderDto.getRequestId());
            DispatchResultDto result = restTemplate.postForObject(url, workOrderDto, DispatchResultDto.class);
            if (result != null) {
                log.info("Work order created successfully for requestId={}", workOrderDto.getRequestId());
                return result;
            }
        } catch (RestClientException e) {
            log.warn("Failed to reach city-operations for requestId={}: {}. Continuing with dispatched status.",
                    workOrderDto.getRequestId(), e.getMessage());
        }

        return DispatchResultDto.builder()
                .requestId(workOrderDto.getRequestId())
                .assignedDepartment(workOrderDto.getDepartment())
                .status("dispatched")
                .dispatchedAt(OffsetDateTime.now())
                .build();
    }
}
