package com.meridian.citizen.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * A service-request lifecycle event row (requests.request_events). One row per
 * state transition; the analytics-service builds the Business Analytics funnels
 * by counting distinct request_id per event_type. (The same transitions are also
 * emitted as JSON business-event logs for Dynatrace — see BusinessEventLogger.)
 */
@Entity
@Table(schema = "requests", name = "request_events")
@Getter
@Setter
@NoArgsConstructor
public class RequestEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
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

    public static RequestEvent of(String requestId, String eventType) {
        RequestEvent e = new RequestEvent();
        e.setRequestId(requestId);
        e.setEventType(eventType);
        return e;
    }
}
