package com.meridian.journey.repository;

import com.meridian.journey.domain.JourneyStage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JourneyStageRepository extends JpaRepository<JourneyStage, String> {

    List<JourneyStage> findByJourneyIdOrderByStageOrderAsc(String journeyId);

    Optional<JourneyStage> findByJourneyIdAndExitedAtIsNullOrderByStageOrderDesc(String journeyId);
}
