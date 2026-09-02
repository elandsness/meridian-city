package com.meridian.workflow.repository;

import com.meridian.workflow.domain.Asset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssetRepository extends JpaRepository<Asset, String> {

    List<Asset> findByAssetType(String assetType);

    List<Asset> findByZoneId(String zoneId);

    Optional<Asset> findByName(String name);
}
