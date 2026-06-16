-- Operator comments on incidents (Stage 4: incident interaction).
CREATE TABLE incidents.incident_comments (
    id BIGSERIAL PRIMARY KEY,
    incident_id VARCHAR(50) NOT NULL REFERENCES incidents.incidents(id),
    author VARCHAR(100),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incident_comments_incident ON incidents.incident_comments(incident_id);
