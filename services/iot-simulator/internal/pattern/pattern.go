// Package pattern generates the next value for a simulated sensor metric,
// given its configured min/max range and a chosen shape. Uses the top-level
// math/rand package functions directly -- Go's global rand source has been
// auto-seeded and safe for concurrent use since Go 1.20, so no per-device or
// per-manager *rand.Rand bookkeeping is needed.
package pattern

import (
	"math"
	"math/rand"
)

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

// Seed returns a reasonable starting value for a metric: steady/driftRandom
// start near the midpoint (with a little noise), cyclic starts at its t=0
// phase.
func Seed(patternName string, min, max, periodSeconds float64) float64 {
	if patternName == "cyclic" {
		return Cyclic(min, max, periodSeconds, 0)
	}
	return Steady(min, max)
}

// Next computes the next value for a metric given its current value and
// elapsed seconds since the device was created (used by the cyclic pattern
// to compute phase independent of tick cadence).
func Next(patternName string, current, min, max, periodSeconds, elapsedSeconds float64) float64 {
	switch patternName {
	case "driftRandom":
		return DriftRandom(current, min, max)
	case "cyclic":
		return Cyclic(min, max, periodSeconds, elapsedSeconds)
	default: // steady
		return Steady(min, max)
	}
}

// Steady returns a value with small random noise around the midpoint of
// [min,max] -- a sensor holding roughly constant.
func Steady(min, max float64) float64 {
	mid := (min + max) / 2
	band := (max - min) * 0.05
	return clamp(mid+(rand.Float64()*2-1)*band, min, max)
}

// DriftRandom performs a bounded random walk: each tick nudges the current
// value by up to ±5% of the full range, clamped to [min,max].
func DriftRandom(current, min, max float64) float64 {
	step := (max - min) * 0.05
	return clamp(current+(rand.Float64()*2-1)*step, min, max)
}

// Cyclic oscillates smoothly between min and max with the given period.
func Cyclic(min, max, periodSeconds, elapsedSeconds float64) float64 {
	if periodSeconds <= 0 {
		periodSeconds = 300
	}
	mid := (min + max) / 2
	amp := (max - min) / 2
	phase := 2 * math.Pi * elapsedSeconds / periodSeconds
	return mid + amp*math.Sin(phase)
}
