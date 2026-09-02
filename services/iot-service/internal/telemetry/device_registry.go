package telemetry

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	_ "github.com/lib/pq"
)

// DeviceRegistry caches device metadata from PostgreSQL.
type DeviceRegistry struct {
	db         *sql.DB
	cache      map[string]DeviceMeta
	mu         sync.RWMutex
	refreshCh  chan time.Time
	stopCh     chan struct{}
}

// DeviceMeta holds device metadata.
type DeviceMeta struct {
	DeviceID    string
	DeviceType  string
	Zone        string
	Category    string
	Manufacturer string
}

// NewDeviceRegistry creates a new DeviceRegistry.
func NewDeviceRegistry(host, dbname, username, password string) *DeviceRegistry {
	dsn := "host=" + host + " dbname=" + dbname + " user=" + username + " password=" + password + " sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	registry := &DeviceRegistry{
		db:        db,
		cache:     make(map[string]DeviceMeta),
		refreshCh: make(chan time.Time),
		stopCh:    make(chan struct{}),
	}

	// Initial refresh
	registry.refresh()

	// Periodic refresh every 60 seconds
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				registry.refresh()
			case <-registry.stopCh:
				return
			}
		}
	}()

	return registry
}

// Start begins the registry.
func (r *DeviceRegistry) Start() {
	log.Println("Device registry started")
}

// Stop halts the registry.
func (r *DeviceRegistry) Stop() {
	close(r.stopCh)
	r.db.Close()
}

// refresh reloads device metadata from PostgreSQL.
func (r *DeviceRegistry) refresh() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := r.db.QueryContext(ctx, `
		SELECT device_id, device_type, zone, category, manufacturer
		FROM city.assets
		WHERE device_type IS NOT NULL
	`)
	if err != nil {
		log.Printf("Failed to refresh device registry: %v", err)
		return
	}
	defer rows.Close()

	newCache := make(map[string]DeviceMeta)
	for rows.Next() {
		var meta DeviceMeta
		if err := rows.Scan(&meta.DeviceID, &meta.DeviceType, &meta.Zone, &meta.Category, &meta.Manufacturer); err != nil {
			log.Printf("Failed to scan device row: %v", err)
			continue
		}
		newCache[meta.DeviceID] = meta
	}

	r.mu.Lock()
	r.cache = newCache
	r.mu.Unlock()

	log.Printf("Device registry refreshed: %d devices", len(newCache))
}

// GetDeviceMeta returns device metadata by device ID.
func (r *DeviceRegistry) GetDeviceMeta(deviceID string) (DeviceMeta, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	meta, ok := r.cache[deviceID]
	return meta, ok
}
