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
	path, ok := entity.Paths[state]
	if !ok || len(path) == 0 {
		return config.Waypoint{}, false
	}

	if len(path) == 1 {
		return path[0], true
	}

	totalSeconds := nextTransitionAt.Sub(stateEnteredAt).Seconds()
	if totalSeconds <= 0 {
		return path[len(path)-1], true
	}

	frac := clamp01(now.Sub(stateEnteredAt).Seconds() / totalSeconds)
	eased := easeInOut(frac)

	segmentFrac := eased * float64(len(path)-1)
	segmentIdx := int(segmentFrac)
	if segmentIdx >= len(path)-1 {
		return path[len(path)-1], true
	}

	localFrac := segmentFrac - float64(segmentIdx)
	p1 := path[segmentIdx]
	p2 := path[segmentIdx+1]

	return config.Waypoint{
		X: p1.X + (p2.X-p1.X)*localFrac,
		Y: p1.Y + (p2.Y-p1.Y)*localFrac,
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
