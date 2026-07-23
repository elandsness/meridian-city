// Package config loads the same mounted industry entity-config JSON the Java
// entity-engine reads (see entity-engine's EntityConfigLoader), but only cares
// about the two things movement-service needs: each entity type's declared
// position waypoints, and the state graph (to know which waypoint to glide
// toward next). Every other key in the file (fields, generator, ...) is
// present in the JSON but simply has no matching struct field here, so
// encoding/json ignores it.
package config

import (
	"encoding/json"
	"os"
)

type transition struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// Waypoint is a scene coordinate for one state, in whatever scene-local units
// the entity type's config declares (e.g. an SVG viewBox) -- movement-service
// is geometry-agnostic beyond interpolating between two of these.
type Waypoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type position struct {
	Waypoints map[string]Waypoint `json:"waypoints"`
}

type computed struct {
	Position *position `json:"position"`
}

type entityDefinition struct {
	Transitions []transition `json:"transitions"`
	Computed    *computed    `json:"computed"`
}

// MovableEntity is the subset of one entity type's config movement-service
// actually needs: its coordinate space and a state -> next-state map (the
// first declared transition out of each state, matching the same "declared
// order, first match" convention the entity engine uses -- see the entity
// engine's TransitionEvaluator/scheduleNext for the authoritative version this
// mirrors for interpolation purposes only).
type MovableEntity struct {
	Waypoints map[string]Waypoint
	NextState map[string]string
}

// Load reads the entity-config JSON at path and returns the entity types that
// declare a computed.position block.
func Load(path string) (map[string]MovableEntity, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var all map[string]entityDefinition
	if err := json.Unmarshal(raw, &all); err != nil {
		return nil, err
	}

	result := make(map[string]MovableEntity)
	for entityType, def := range all {
		if def.Computed == nil || def.Computed.Position == nil || len(def.Computed.Position.Waypoints) == 0 {
			continue
		}
		nextState := make(map[string]string)
		for _, t := range def.Transitions {
			if _, exists := nextState[t.From]; !exists {
				nextState[t.From] = t.To
			}
		}
		result[entityType] = MovableEntity{
			Waypoints: def.Computed.Position.Waypoints,
			NextState: nextState,
		}
	}
	return result, nil
}
