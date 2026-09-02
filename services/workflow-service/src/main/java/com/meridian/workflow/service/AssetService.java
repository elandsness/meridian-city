package com.meridian.workflow.service;

import com.meridian.workflow.domain.Asset;
import com.meridian.workflow.repository.AssetRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class AssetService {

    private static final Logger log = LoggerFactory.getLogger(AssetService.class);

    private final AssetRepository assetRepository;

    public AssetService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    @Transactional(readOnly = true)
    public List<Asset> listAssets(String assetType) {
        if (assetType != null && !assetType.isBlank()) {
            return assetRepository.findByAssetType(assetType);
        }
        return assetRepository.findAll();
    }

    @Transactional(readOnly = true)
    public Asset findAsset(String id) {
        return assetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Asset not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<Asset> listBuildings() {
        return assetRepository.findByAssetType("building");
    }
}
