package com.meridian.dispatch.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(schema = "requests", name = "dispatch_log")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DispatchLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "request_id", nullable = false, length = 50)
    private String requestId;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "zone_id", length = 50)
    private String zoneId;

    @Column(name = "assigned_department", length = 100)
    private String assignedDepartment;

    @Column(name = "routing_reason", columnDefinition = "TEXT")
    private String routingReason;

    @Column(name = "dispatched_at")
    private OffsetDateTime dispatchedAt;

    @PrePersist
    protected void onCreate() {
        if (dispatchedAt == null) {
            dispatchedAt = OffsetDateTime.now();
        }
    }
}
