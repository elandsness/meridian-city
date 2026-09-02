package com.meridian.identity.domain;

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
 * An account-creation lifecycle event row (identity.identity_events). One row per
 * transition; the analytics-service builds the account-creation funnel by counting
 * distinct identity_id per event_type. (Also emitted as JSON business-event logs.)
 */
@Entity
@Table(schema = "identity", name = "identity_events")
@Getter
@Setter
@NoArgsConstructor
public class IdentityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "identity_id", nullable = false, length = 50)
    private String identityId;

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

    public static IdentityEvent of(String identityId, String eventType) {
        IdentityEvent e = new IdentityEvent();
        e.setIdentityId(identityId);
        e.setEventType(eventType);
        return e;
    }
}
