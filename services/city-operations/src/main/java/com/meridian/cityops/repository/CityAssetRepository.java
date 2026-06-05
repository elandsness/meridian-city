package com.meridian.cityops.repository;

import com.meridian.cityops.domain.CityAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CityAssetRepository extends JpaRepository<CityAsset, String> {

    List<CityAsset> findByAssetType(String assetType);

    List<CityAsset> findByZoneId(String zoneId);
}
