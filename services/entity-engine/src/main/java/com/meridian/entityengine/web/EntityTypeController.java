package com.meridian.entityengine.web;

import com.meridian.entityengine.config.EntityConfigLoader;
import com.meridian.entityengine.dto.EntityTypeSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Read-only entity-type metadata -- lets a generic consumer (e.g. the ops
 * Command Center aggregator in demo-control-api) discover what entity types
 * and states this instance knows about without parsing the industry config
 * file itself. Uses allDefinitions (same as EntityController), not the
 * ownership-filtered set -- metadata discovery isn't about which instance
 * runs the scheduled/generator work for a type.
 */
@RestController
@RequestMapping("/api/v1/entity-types")
@RequiredArgsConstructor
public class EntityTypeController {

    private final EntityConfigLoader configLoader;

    @GetMapping
    public List<EntityTypeSummary> list() {
        return configLoader.getAllDefinitions().entrySet().stream()
                .map(e -> new EntityTypeSummary(e.getKey(), e.getValue()))
                .toList();
    }
}
