package com.meridian.entityengine.web;

import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.dto.EntityResponse;
import com.meridian.entityengine.service.EntityEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Generic REST surface for every entity type this instance owns. There is
 * deliberately no per-entity-type controller anywhere in this service.
 */
@RestController
@RequestMapping("/api/v1/entities")
@RequiredArgsConstructor
public class EntityController {

    private final EntityEngineService service;

    @GetMapping("/{entityType}")
    public List<EntityResponse> list(@PathVariable String entityType,
                                      @RequestParam(required = false) String state) {
        return service.list(entityType, state).stream().map(EntityResponse::new).toList();
    }

    @GetMapping("/{entityType}/{id}")
    public EntityResponse get(@PathVariable String entityType, @PathVariable String id) {
        return new EntityResponse(service.get(entityType, id));
    }

    @PostMapping("/{entityType}/{id}/actions/{action}")
    public EntityResponse runAction(@PathVariable String entityType, @PathVariable String id,
                                     @PathVariable String action) {
        EntityRecord record = service.runAction(entityType, id, action);
        return new EntityResponse(record);
    }
}
