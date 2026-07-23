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
	From string                 `json:"from"`
	To   string                 `json:"to"`
	When map[string]interface{} `json:"when"`
}

// isStochastic reports whether a transition's condition is a probability/
// faultGate roll (the ~20%-chance branches like a fault/error path) rather
// than a deterministic one -- used only to pick a sane default glide target
// below, never to decide which transition actually fires (that stays entirely
// entity-engine's job).
func isStochastic(when map[string]interface{}) bool {
	if when == nil {
		return false
	}
	_, hasProbability := when["probability"]
	_, hasFaultGate := when["faultGate"]
	return hasProbability || hasFaultGate
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
// actually needs: its coordinate space and a state -> next-state map, used
// only to pick which waypoint to glide toward -- entity-engine's
// TransitionEvaluator remains the sole authority on which transition actually
// fires.
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
		// Prefer the first DETERMINISTIC outgoing transition per state as the
		// glide target -- e.g. for "scanning: fault_detected (20% chance) |
		// validating (otherwise)", declared in that order, glide toward
		// "validating" (the common case) rather than "fault_detected" (a rare
		// branch declared first). Falls back to the first declared transition
		// for any state where every outgoing transition is stochastic.
		firstAny := make(map[string]string)
		nextState := make(map[string]string)
		for _, t := range def.Transitions {
			if _, exists := firstAny[t.From]; !exists {
				firstAny[t.From] = t.To
			}
			if _, exists := nextState[t.From]; !exists && !isStochastic(t.When) {
				nextState[t.From] = t.To
			}
		}
		for from, to := range firstAny {
			if _, exists := nextState[from]; !exists {
				nextState[from] = to
			}
		}
		result[entityType] = MovableEntity{
			Waypoints: def.Computed.Position.Waypoints,
			NextState: nextState,
		}
	}
	return result, nil
}
