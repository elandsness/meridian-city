package com.meridian.cityops.service;

import com.meridian.cityops.domain.Building;
import com.meridian.cityops.domain.CityAsset;
import com.meridian.cityops.dto.AssetResponse;
import com.meridian.cityops.dto.BuildingResponse;
import com.meridian.cityops.repository.BuildingRepository;
import com.meridian.cityops.repository.CityAssetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CityAssetService {

    private final CityAssetRepository cityAssetRepository;
    private final BuildingRepository buildingRepository;

    @Transactional(readOnly = true)
    public List<AssetResponse> listAssets(String assetType) {
        List<CityAsset> assets = (assetType != null && !assetType.isBlank())
                ? cityAssetRepository.findByAssetType(assetType)
                : cityAssetRepository.findAll();
        return assets.stream().map(this::toAssetResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<BuildingResponse> listBuildings() {
        // Join building data with asset status from the assets table
        return buildingRepository.findAll().stream()
                .map(b -> {
                    String status = cityAssetRepository.findById(b.getId())
                            .map(CityAsset::getStatus)
                            .orElse("unknown");
                    return toBuildingResponse(b, status);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public AssetResponse findAsset(String id) {
        CityAsset asset = cityAssetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Asset not found: " + id));
        return toAssetResponse(asset);
    }

    // -------------------------------------------------------------------------

    private AssetResponse toAssetResponse(CityAsset asset) {
        return AssetResponse.builder()
                .id(asset.getId())
                .name(asset.getName())
                .assetType(asset.getAssetType())
                .zoneId(asset.getZoneId())
                .status(asset.getStatus())
                .build();
    }

    private BuildingResponse toBuildingResponse(Building building, String status) {
        return BuildingResponse.builder()
                .id(building.getId())
                .name(building.getName())
                .zoneId(building.getZoneId())
                .floors(building.getFloors())
                .status(status)
                .build();
    }
}
