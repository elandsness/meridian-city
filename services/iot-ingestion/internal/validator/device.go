package validator

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// Validator validates device IDs against the city.assets table in PostgreSQL,
// with an in-memory cache refreshed every 60 seconds.
type Validator struct {
	db          *sql.DB
	cache       map[string]bool
	cacheMu     sync.RWMutex
	refreshDone chan struct{}
}

// NewValidator creates a new Validator with an open DB connection.
// dbDSN format: postgres://user:pass@host:port/dbname?sslmode=disable
func NewValidator(db *sql.DB) *Validator {
	return &Validator{
		db:          db,
		cache:       make(map[string]bool),
		refreshDone: make(chan struct{}),
	}
}

// NewDB opens a PostgreSQL connection using the provided parameters.
func NewDB(host, port, user, password, dbname string) (*sql.DB, error) {
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable", user, password, host, port, dbname)
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)
	return db, nil
}

// Start launches a background goroutine that refreshes the device cache every 60 seconds.
// The goroutine exits when ctx is cancelled.
func (v *Validator) Start(ctx context.Context) {
	// Initial load — errors are tolerated.
	v.refresh(ctx)

	go func() {
		defer close(v.refreshDone)
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				v.refresh(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// IsKnown returns true if the deviceID is in the cache.
// Fail-open: if the cache is empty (e.g., DB unreachable at startup) returns true
// so no telemetry is dropped during a demo.
func (v *Validator) IsKnown(deviceID string) bool {
	v.cacheMu.RLock()
	defer v.cacheMu.RUnlock()

	if len(v.cache) == 0 {
		// Fail-open: don't drop telemetry when cache hasn't loaded yet.
		return true
	}
	return v.cache[deviceID]
}

// refresh queries city.assets and rebuilds the in-memory cache.
// On error, logs and keeps the old cache.
func (v *Validator) refresh(ctx context.Context) {
	rows, err := v.db.QueryContext(ctx, "SELECT id FROM city.assets")
	if err != nil {
		log.Printf("[validator] warning: failed to refresh device cache: %v — keeping old cache", err)
		return
	}
	defer rows.Close()

	newCache := make(map[string]bool)
	for rows.Next() {
		var assetID string
		if err := rows.Scan(&assetID); err != nil {
			log.Printf("[validator] warning: failed to scan asset_id: %v", err)
			continue
		}
		newCache[assetID] = true
	}
	if err := rows.Err(); err != nil {
		log.Printf("[validator] warning: row iteration error: %v — keeping old cache", err)
		return
	}

	v.cacheMu.Lock()
	v.cache = newCache
	v.cacheMu.Unlock()

	log.Printf("[validator] device cache refreshed: %d known devices", len(newCache))
}
