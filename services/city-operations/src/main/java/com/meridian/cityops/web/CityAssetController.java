package com.meridian.cityops.web;

import com.meridian.cityops.dto.AssetResponse;
import com.meridian.cityops.dto.BuildingResponse;
import com.meridian.cityops.service.CityAssetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CityAssetController {

    private final CityAssetService cityAssetService;

    @GetMapping("/api/v1/assets")
    public List<AssetResponse> listAssets(
            @RequestParam(name = "type", required = false) String assetType) {
        return cityAssetService.listAssets(assetType);
    }

    @GetMapping("/api/v1/assets/{id}")
    public AssetResponse getAsset(@PathVariable String id) {
        return cityAssetService.findAsset(id);
    }

    @GetMapping("/api/v1/city/buildings")
    public List<BuildingResponse> listBuildings() {
        return cityAssetService.listBuildings();
    }
}
