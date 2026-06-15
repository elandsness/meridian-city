package com.meridian.dispatch.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

/**
 * A service-request lifecycle event row (requests.request_events). service-dispatch
 * records the `service_request.dispatched` / `service_request.assigned` transitions;
 * the analytics-service builds the Business Analytics funnel by counting distinct
 * request_id per event_type. (The same transitions are also emitted as JSON
 * business-event logs for Dynatrace — see BusinessEventLogger.)
 */
@Entity
@Table(schema = "requests", name = "request_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RequestEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, length = 50)
    private String requestId;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }
}
