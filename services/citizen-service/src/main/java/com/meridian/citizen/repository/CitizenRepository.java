package com.meridian.citizen.repository;

import com.meridian.citizen.domain.Citizen;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CitizenRepository extends JpaRepository<Citizen, String> {

    Optional<Citizen> findByEmail(String email);

    List<Citizen> findByAccountLifecycleStageInAndAccountNextTransitionAtLessThanEqual(
            Collection<String> stages, OffsetDateTime cutoff);
}
