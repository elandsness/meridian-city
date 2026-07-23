// Package position computes an entity's scene coordinate from its real,
// backend-authoritative timing (state_entered_at / next_transition_at) --
// never a client-invented guess. This is the direct generalization of the
// old AirfieldMap.jsx's planePose(): same lerp-between-two-nodes-with-easing
// idea, except the waypoint table now lives once in backend config instead of
// hardcoded identically in two frontend files, and the interpolation runs
// here rather than being reinvented per page.
package position

import (
	"math"
	"time"

	"github.com/meridian/movement-service/internal/config"
)

// Compute returns the entity's current scene coordinate, and whether a
// coordinate could be determined at all (false if the current state has no
// declared waypoint).
func Compute(entity config.MovableEntity, state string, stateEnteredAt time.Time, nextTransitionAt *time.Time, now time.Time) (config.Waypoint, bool) {
	current, ok := entity.Waypoints[state]
	if !ok {
		return config.Waypoint{}, false
	}

	nextState, hasNext := entity.NextState[state]
	target, hasTargetWaypoint := entity.Waypoints[nextState]
	if !hasNext || !hasTargetWaypoint || nextTransitionAt == nil {
		// Terminal state, or the next state has no waypoint of its own -- hold
		// position rather than guessing where to glide.
		return current, true
	}

	totalSeconds := nextTransitionAt.Sub(stateEnteredAt).Seconds()
	if totalSeconds <= 0 {
		return target, true // already past the scheduled transition time
	}
	frac := clamp01(now.Sub(stateEnteredAt).Seconds() / totalSeconds)
	eased := easeInOut(frac)

	return config.Waypoint{
		X: current.X + (target.X-current.X)*eased,
		Y: current.Y + (target.Y-current.Y)*eased,
	}, true
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

func easeInOut(t float64) float64 {
	if t < 0.5 {
		return 2 * t * t
	}
	return 1 - math.Pow(-2*t+2, 2)/2
}
