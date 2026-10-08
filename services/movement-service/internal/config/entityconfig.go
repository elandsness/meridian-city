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

func isStochastic(when map[string]interface{}) bool {
	if when == nil {
		return false
	}
	_, hasProbability := when["probability"]
	_, hasFaultGate := when["faultGate"]
	return hasProbability || hasFaultGate
}

type Waypoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type position struct {
	// Use interface{} to capture either a single Waypoint or a slice of Waypoints
	Waypoints map[string]interface{} `json:"waypoints"`
}

type computed struct {
	Position *position `json:"position"`
}

type entityDefinition struct {
	Transitions []transition `json:"transitions"`
	Computed    *computed    `json:"computed"`
}

type MovableEntity struct {
	Paths map[string][]Waypoint
	NextState map[string]string
}

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
		if def.Computed == nil || def.Computed.Position == nil || def.Computed.Position.Waypoints == nil {
			continue
		}

		paths := make(map[string][]Waypoint)
		for state, val := range def.Computed.Position.Waypoints {
			// Case 1: It's already a slice ([]interface{})
			if slice, ok := val.([]interface{}); ok {
				pts := make([]Waypoint, 0, len(slice))
				for _, item := range slice {
					if m, ok := item.(map[string]interface{}); ok {
						pts = append(pts, Waypoint{
							X: castFloat(m["x"]),
							Y: castFloat(m["y"]),
						})
					}
				}
				paths[state] = pts
			} else if m, ok := val.(map[string]interface{}); ok {
				// Case 2: It's a single point map - wrap it in a slice for the engine
				paths[state] = []Waypoint{{
					X: castFloat(m["x"]),
					Y: castFloat(m["y"]),
				}}
			}
		}

		if len(paths) == 0 {
			continue
		}

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
			Paths: paths,
			NextState: nextState,
		}
	}
	return result, nil
}

func castFloat(i interface{}) float64 {
	if f, ok := i.(float64); ok {
		return f
	}
	return 0.0
}
