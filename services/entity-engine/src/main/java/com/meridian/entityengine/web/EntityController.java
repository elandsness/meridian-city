package com.meridian.entityengine.web;

import com.meridian.entityengine.domain.EntityRecord;
import com.meridian.entityengine.dto.EntityResponse;
import com.meridian.entityengine.service.EntityEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
                                      @RequestParam(required = false) String state,
                                      @RequestParam Map<String, String> allParams) {
        // Strip known non-field params before passing the rest as field filters.
        Map<String, String> fieldFilters = new java.util.HashMap<>(allParams);
        fieldFilters.remove("state");
        fieldFilters.remove("page");
        fieldFilters.remove("limit");
        return service.list(entityType, state, fieldFilters.isEmpty() ? null : fieldFilters)
                .stream().map(EntityResponse::new).toList();
    }

    @GetMapping("/{entityType}/{id}")
    public EntityResponse get(@PathVariable String entityType, @PathVariable String id) {
        return new EntityResponse(service.get(entityType, id));
    }

    /** Client-submitted create, e.g. a citizen registering, a service request being
     * submitted, a cart item being added -- the generator isn't the only source of
     * entities once a real industry retrofit (not just a synthetic proof) is live. */
    @PostMapping("/{entityType}")
    public EntityResponse create(@PathVariable String entityType, @RequestBody(required = false) Map<String, Object> body) {
        return new EntityResponse(service.createFromClient(entityType, body));
    }

    @PostMapping("/{entityType}/{id}/actions/{action}")
    public EntityResponse runAction(@PathVariable String entityType, @PathVariable String id,
                                     @PathVariable String action) {
        EntityRecord record = service.runAction(entityType, id, action);
        return new EntityResponse(record);
    }
}
