package com.meridian.workflow.repository;

import com.meridian.workflow.domain.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, String> {

    List<Incident> findByStatus(String status);

    Optional<Incident> findByAssetId(String assetId);
}
