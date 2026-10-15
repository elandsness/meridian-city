package com.meridian.journey.repository;

import com.meridian.journey.domain.JourneyConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JourneyConfigRepository extends JpaRepository<JourneyConfig, String> {

    List<JourneyConfig> findByIsUserLinkedTrue();
}
