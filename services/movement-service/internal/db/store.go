// Package db reads/writes the shared entities.entity table -- the same
// generic store the Java entity-engine owns. movement-service only ever
// touches the `data.position` key via a targeted jsonb_set, never a whole-row
// rewrite, so a concurrent write from entity-engine (a state transition) can
// never be silently clobbered by a movement tick and vice versa.
package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/lib/pq"
)

type EntityRow struct {
	ID               string
	EntityType       string
	State            string
	StateEnteredAt   time.Time
	NextTransitionAt *time.Time
}

func Open(host, port, user, password, dbname string) (*sql.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)
	return sql.Open("postgres", dsn)
}

// FetchActive returns every entity of the given types (regardless of state --
// even a terminal entity keeps its final position rendered until it's no
// longer polled by the frontend).
func FetchActive(db *sql.DB, entityTypes []string) ([]EntityRow, error) {
	rows, err := db.Query(
		`SELECT id, entity_type, state, state_entered_at, next_transition_at
		   FROM entities.entity
		  WHERE entity_type = ANY($1)`,
		pq.Array(entityTypes),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []EntityRow
	for rows.Next() {
		var r EntityRow
		var nextTransitionAt sql.NullTime
		if err := rows.Scan(&r.ID, &r.EntityType, &r.State, &r.StateEnteredAt, &nextTransitionAt); err != nil {
			return nil, err
		}
		if nextTransitionAt.Valid {
			r.NextTransitionAt = &nextTransitionAt.Time
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// UpdatePosition writes only the `position` key inside the `data` JSONB
// column via jsonb_set -- never a whole-row read-modify-write -- so it can
// never clobber a concurrent field/state change made by entity-engine.
func UpdatePosition(db *sql.DB, id string, x, y float64) error {
	_, err := db.Exec(
		`UPDATE entities.entity
		    SET data = jsonb_set(data, '{position}', jsonb_build_object('x', $2::float8, 'y', $3::float8)),
		        updated_at = now()
		  WHERE id = $1`,
		id, x, y,
	)
	return err
}
