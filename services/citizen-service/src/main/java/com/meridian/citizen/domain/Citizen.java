package com.meridian.citizen.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.Random;

@Entity
@Table(schema = "citizens", name = "citizens")
@Getter
@Setter
@NoArgsConstructor
public class Citizen {

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

    /**
     * Cursor for the deferred account-creation flow (verification_sent -> verified ->
     * activated, or the abandoned/verified_only drop-off terminals). The signup burst is
     * emitted synchronously at registration; the AccountLifecycleScheduler advances from here.
     */
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

    public static Citizen create(String firstName, String lastName, String email, String zoneId) {
        Citizen citizen = new Citizen();
        citizen.setId("cit-" + generateSuffix());
        citizen.setFirstName(firstName);
        citizen.setLastName(lastName);
        citizen.setEmail(email);
        citizen.setZoneId(zoneId);
        return citizen;
    }

    private static String generateSuffix() {
        StringBuilder sb = new StringBuilder(5);
        for (int i = 0; i < 5; i++) {
            sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
        }
        return sb.toString();
    }
}
