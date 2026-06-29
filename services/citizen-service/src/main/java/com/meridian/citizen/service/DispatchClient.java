package com.meridian.citizen.service;

import com.meridian.citizen.domain.ServiceRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * Synchronous HTTP client for service-dispatch.
 *
 * The synchronous call is intentional — it keeps the entire request flow
 * within a single distributed trace, allowing Dynatrace to capture a
 * multi-hop waterfall: api-gateway -> citizen-service -> service-dispatch -> city-operations.
 */
@Service
public class DispatchClient {

    private static final Logger log = LoggerFactory.getLogger(DispatchClient.class);

    private final RestTemplate restTemplate;
    private final String serviceDispatchUrl;

    public DispatchClient(RestTemplate restTemplate,
                          @Value("${service-dispatch.url}") String serviceDispatchUrl) {
        this.restTemplate = restTemplate;
        this.serviceDispatchUrl = serviceDispatchUrl;
    }

    /**
     * Dispatches a service request to the service-dispatch service.
     * If dispatch fails, the error is logged and the method returns false
     * so the caller can continue — the request was already persisted.
     *
     * <p>{@code dispatchedAt}/{@code assignedAt} are the absolute target times at which
     * service-dispatch should emit the dispatched/assigned business events. citizen-service
     * computes the full timeline so the steps stay strictly ordered; they are sent as
     * ISO-8601 strings (independent of the RestTemplate's JSON time config) and parsed back
     * into OffsetDateTime by service-dispatch's Jackson (jsr310). May be null when the
     * lifecycle is disabled.
     *
     * @param request the service request to dispatch
     * @return true if dispatch succeeded, false otherwise
     */
    public boolean dispatchRequest(ServiceRequest request,
                                   OffsetDateTime dispatchedAt, OffsetDateTime assignedAt) {
        String url = serviceDispatchUrl + "/api/v1/dispatch";

        Map<String, Object> body = new HashMap<>();
        body.put("requestId", request.getId());
        body.put("citizenId", request.getCitizenId());
        body.put("category", request.getCategory());
        body.put("priority", request.getPriority());
        body.put("zoneId", request.getZoneId());
        if (dispatchedAt != null) {
            body.put("dispatchedAt", dispatchedAt.toString());
        }
        if (assignedAt != null) {
            body.put("assignedAt", assignedAt.toString());
        }

        try {
            log.debug("Dispatching requestId={} to service-dispatch at {}", request.getId(), url);
            restTemplate.postForObject(url, body, Map.class);
            log.debug("Dispatch acknowledged for requestId={}", request.getId());
            return true;
        } catch (RestClientException ex) {
            log.error("Dispatch failed for requestId={}: {} — continuing with submitted status",
                    request.getId(), ex.getMessage());
            return false;
        }
    }
}
