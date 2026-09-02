package com.meridian.identity.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Random;

/**
 * Represents a user identity in the system (e.g., citizen, customer, passenger).
 * The account lifecycle is configurable via industry config.
 */
@Entity
@Table(schema = "identity", name = "identities")
@Getter
@Setter
@NoArgsConstructor
public class Identity {

    private static final String ALPHANUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final Random RANDOM = new Random();

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "zone_id", length = 50)
    private String zoneId;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    @Column(name = "account_lifecycle_stage", length = 30)
    private String accountLifecycleStage;

    @Column(name = "account_next_transition_at")
    private OffsetDateTime accountNextTransitionAt;

    @PrePersist
    protected void onCreate() {
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public static Identity create(String firstName, String lastName, String email, String zoneId) {
        Identity identity = new Identity();
        identity.setId("id-" + generateSuffix());
        identity.setFirstName(firstName);
        identity.setLastName(lastName);
        identity.setEmail(email);
        identity.setZoneId(zoneId);
        return identity;
    }

    private static String generateSuffix() {
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }
}
