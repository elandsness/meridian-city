package com.meridian.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Login credentials for an identity (identity.accounts). Linked 1:1 to an identity
 * via identity_id; the password is stored as a BCrypt hash. Identities registered
 * without a password (e.g. by traffic-bot) simply have no account row and can't
 * log in.
 */
@Entity
@Table(schema = "identity", name = "accounts")
@Getter
@Setter
@NoArgsConstructor
public class Account {

    @Id
    @Column(name = "id", length = 50)
    private String id;

    @Column(name = "identity_id", nullable = false, length = 50)
    private String identityId;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
        if (isActive == null) {
            isActive = true;
        }
    }

    public static Account create(String identityId, String passwordHash) {
        Account account = new Account();
        account.setId("acct-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        account.setIdentityId(identityId);
        account.setPasswordHash(passwordHash);
        account.setIsActive(true);
        return account;
    }
}
