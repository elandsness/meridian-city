package com.meridian.workflow.web;

import com.meridian.workflow.domain.Asset;
import com.meridian.workflow.service.AssetService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/assets")
public class AssetController {

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    @GetMapping
    public List<Asset> listAssets(@RequestParam(required = false) String type) {
        return assetService.listAssets(type);
    }

    @GetMapping("/{id}")
    public Asset findAsset(@PathVariable String id) {
        return assetService.findAsset(id);
    }

    @GetMapping("/buildings")
    public List<Asset> listBuildings() {
        return assetService.listBuildings();
    }
}
