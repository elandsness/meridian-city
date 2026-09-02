package position

import (
	"testing"
	"time"

	"github.com/meridian/movement-service/internal/config"
)

func testEntity() config.MovableEntity {
	return config.MovableEntity{
		Waypoints: map[string]config.Waypoint{
			"queued":   {X: 0, Y: 0},
			"scanning": {X: 100, Y: 0},
			"complete": {X: 200, Y: 0},
		},
		NextState: map[string]string{
			"queued":   "scanning",
			"scanning": "complete",
		},
	}
}

func TestCompute_AtStartOfWindow_ReturnsCurrentWaypoint(t *testing.T) {
	entity := testEntity()
	now := time.Now()
	enteredAt := now
	nextAt := now.Add(10 * time.Second)

	wp, ok := Compute(entity, "queued", enteredAt, &nextAt, now)

	if !ok {
		t.Fatal("expected a coordinate")
	}
	if wp.X != 0 || wp.Y != 0 {
		t.Errorf("expected to still be at the queued waypoint, got %+v", wp)
	}
}

func TestCompute_MidWindow_IsBetweenWaypoints(t *testing.T) {
	entity := testEntity()
	now := time.Now()
	enteredAt := now.Add(-5 * time.Second)
	nextAt := now.Add(5 * time.Second) // 10s window, 5s elapsed = frac 0.5

	wp, ok := Compute(entity, "queued", enteredAt, &nextAt, now)

	if !ok {
		t.Fatal("expected a coordinate")
	}
	if wp.X <= 0 || wp.X >= 100 {
		t.Errorf("expected X strictly between the two waypoints at the midpoint, got %v", wp.X)
	}
}

func TestCompute_PastScheduledTransition_ReturnsTargetWaypoint(t *testing.T) {
	entity := testEntity()
	now := time.Now()
	enteredAt := now.Add(-20 * time.Second)
	nextAt := now.Add(-10 * time.Second) // already in the past

	wp, ok := Compute(entity, "queued", enteredAt, &nextAt, now)

	if !ok {
		t.Fatal("expected a coordinate")
	}
	if wp.X != 100 || wp.Y != 0 {
		t.Errorf("expected to have arrived at the scanning waypoint, got %+v", wp)
	}
}

func TestCompute_TerminalState_HoldsPosition(t *testing.T) {
	entity := testEntity()
	now := time.Now()

	wp, ok := Compute(entity, "complete", now.Add(-time.Minute), nil, now)

	if !ok {
		t.Fatal("expected a coordinate")
	}
	if wp.X != 200 || wp.Y != 0 {
		t.Errorf("expected to hold the complete waypoint, got %+v", wp)
	}
}

func TestCompute_UnknownState_ReturnsFalse(t *testing.T) {
	entity := testEntity()
	now := time.Now()

	_, ok := Compute(entity, "nonexistent", now, nil, now)

	if ok {
		t.Error("expected ok=false for a state with no declared waypoint")
	}
}
