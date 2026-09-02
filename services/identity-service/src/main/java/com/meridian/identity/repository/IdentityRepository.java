package com.meridian.identity.repository;

import com.meridian.identity.domain.Identity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface IdentityRepository extends JpaRepository<Identity, String> {

    Optional<Identity> findByEmail(String email);

    List<Identity> findByAccountLifecycleStageInAndAccountNextTransitionAtLessThanEqual(
            Collection<String> stages, OffsetDateTime cutoff);
}
