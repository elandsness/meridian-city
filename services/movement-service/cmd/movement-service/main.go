// movement-service is the fast, dedicated tick that turns each entity's
// real backend state/timing into a scene coordinate (see internal/position).
// Deliberately its own process, separate from entity-engine's heavier
// transactional business tick: a tight, jitter-free cadence for "smooth
// continuous glide" shouldn't compete with entity-engine's GC/connection-pool
// pressure -- and Go is already this codebase's language for tick-driven
// simulators (iot-simulator), so this keeps to that precedent.
package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/meridian/movement-service/internal/config"
	"github.com/meridian/movement-service/internal/db"
	"github.com/meridian/movement-service/internal/position"
)

func getEnv(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}

func main() {
	dbHost := getEnv("DB_HOST", "postgresql")
	dbPort := getEnv("DB_PORT", "5432")
	dbName := getEnv("DB_NAME", "meridian")
	dbUser := getEnv("DB_USER", "meridian")
	dbPassword := getEnv("DB_PASSWORD", "meridian")
	configPath := getEnv("ENTITY_CONFIG_PATH", "/etc/meridian/entity-config.json")
	healthPort := getEnv("HEALTH_PORT", "8095")
	tickMs, err := strconv.Atoi(getEnv("MOVEMENT_TICK_MS", "2000"))
	if err != nil || tickMs <= 0 {
		tickMs = 2000
	}

	entities, err := config.Load(configPath)
	if err != nil {
		// No entity types declare a position to track without this file -- fail
		// open (health stays up, the tick loop just has nothing to do) rather
		// than crash-loop, since a Stage-2/synthetic-only deploy may not mount
		// one yet.
		log.Printf("[main] warning: could not load entity config at %s: %v -- tracking no entity types", configPath, err)
		entities = map[string]config.MovableEntity{}
	}
	entityTypes := make([]string, 0, len(entities))
	for t := range entities {
		entityTypes = append(entityTypes, t)
	}
	log.Printf("[main] movement-service started, tracking position for entity types: %v", entityTypes)

	sqlDB, err := db.Open(dbHost, dbPort, dbUser, dbPassword, dbName)
	if err != nil {
		log.Fatalf("[main] could not open database: %v", err)
	}
	defer sqlDB.Close()

	go startHealthServer(healthPort)

	ticker := time.NewTicker(time.Duration(tickMs) * time.Millisecond)
	defer ticker.Stop()
	for range ticker.C {
		runTick(sqlDB, entities, entityTypes)
	}
}

func runTick(sqlDB *sql.DB, entities map[string]config.MovableEntity, entityTypes []string) {
	if len(entityTypes) == 0 {
		return
	}
	rows, err := db.FetchActive(sqlDB, entityTypes)
	if err != nil {
		log.Printf("[tick] fetch failed: %v", err)
		return
	}
	now := time.Now()
	for _, r := range rows {
		entity, ok := entities[r.EntityType]
		if !ok {
			continue
		}
		wp, ok := position.Compute(entity, r.State, r.StateEnteredAt, r.NextTransitionAt, now)
		if !ok {
			continue
		}
		// Extract current path for the DB record
		var pathPoints []float64
		for _, p := range entity.Paths[r.State] {
			pathPoints = append(pathPoints, p.X, p.Y)
		}

		// Determine target (next waypoint in path, or hold if at end)
		tx, ty := wp.X, wp.Y
		if len(entity.Paths[r.State]) > 1 {
			// Find which segment the entity is currently in
			totalSeconds := r.NextTransitionAt.Sub(r.StateEnteredAt).Seconds()
			if totalSeconds > 0 {
				frac := (float64(time.Now().Sub(r.StateEnteredAt).Seconds()) / totalSeconds)
				segIdx := int(frac * float64(len(entity.Paths[r.State])-1))
				if segIdx < len(entity.Paths[r.State]) - 1 {
					nextPt := entity.Paths[r.State][segIdx+1]
					tx, ty = nextPt.X, nextPt.Y
				} else {
					tx, ty = entity.Paths[r.State][len(entity.Paths[r.State])-1].X, entity.Paths[r.State][len(entity.Paths[r.State])-1].Y
				}
			}
		}

		if err := db.UpdatePosition(sqlDB, r.ID, wp.X, wp.Y, tx, ty, pathPoints); err != nil {
			log.Printf("[tick] position update failed for id=%s: %v", r.ID, err)
		}
	}
}

func startHealthServer(port string) {
	http.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	log.Printf("[health] listening on :%s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Printf("[health] server error: %v", err)
	}
}
