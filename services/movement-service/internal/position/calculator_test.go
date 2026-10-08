package position

import (
	"testing"
	"time"

	"github.com/meridian/movement-service/internal/config"
)

func createComplexEntity() config.MovableEntity {
	return config.MovableEntity{
		Paths: map[string][]config.Waypoint{
			"taxiing": {
				{X: 0, Y: 0},   // Start
				{X: 100, Y: 0}, // Mid 1
				{X: 100, Y: 100}, // Mid 2
				{X: 200, Y: 100}, // End
			},
			"stationary": {
				{X: 50, Y: 50},
			},
		},
		NextState: map[string]string{
			"taxiing": "stationary",
		},
	}
}

func TestCompute_PathBoundaries(t *testing.T) {
	entity := createComplexEntity()
	now := time.Now()
	enteredAt := now.Add(-10 * time.Second)
	nextAt := now // Exactly at transition time

	wp, ok := Compute(entity, "taxiing", enteredAt, &nextAt, now)
	if !ok || wp.X != 200 || wp.Y != 100 {
		t.Errorf("Expected final waypoint [200,100] at transition time, got [%v, %v]", wp.X, wp.Y)
	}
}

func TestCompute_SinglePointPath_HoldsPosition(t *testing.T) {
	entity := createComplexEntity()
	now := time.Now()
	enteredAt := now.Add(-5 * time.Second)
	nextAt := now.Add(5 * time.Second)

	wp, ok := Compute(entity, "stationary", enteredAt, &nextAt, now)
	if !ok || wp.X != 50 || wp.Y != 50 {
		t.Errorf("Expected stationary point [50,50], got [%v, %v]", wp.X, wp.Y)
	}
}

func TestCompute_UnknownState_ReturnsFalse(t *testing.T) {
	entity := createComplexEntity()
	_, ok := Compute(entity, "void", time.Now(), nil, time.Now())
	if ok {
		t.Error("Expected ok=false for unknown state")
	}
}
