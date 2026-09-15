CREATE SCHEMA IF NOT EXISTS entities;

CREATE TABLE entities.entity (
    id                 VARCHAR(64) PRIMARY KEY,
    entity_type        VARCHAR(64)  NOT NULL,
    state              VARCHAR(64)  NOT NULL,
    data               JSONB        NOT NULL DEFAULT '{}'::jsonb,
    links              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    state_entered_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    next_transition_at TIMESTAMPTZ,
    owner_id           VARCHAR(64),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_type_state_next ON entities.entity (entity_type, state, next_transition_at);
CREATE INDEX idx_entity_type_next       ON entities.entity (entity_type, next_transition_at) WHERE next_transition_at IS NOT NULL;
CREATE INDEX idx_entity_owner           ON entities.entity (owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX idx_entity_links_gin       ON entities.entity USING GIN (links);
CREATE INDEX idx_entity_data_gin        ON entities.entity USING GIN (data jsonb_path_ops);

CREATE TABLE entities.entity_event (
    id          BIGSERIAL PRIMARY KEY,
    entity_id   VARCHAR(64) NOT NULL REFERENCES entities.entity(id),
    entity_type VARCHAR(64) NOT NULL,
    event_type  VARCHAR(128) NOT NULL,
    from_state  VARCHAR(64),
    to_state    VARCHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_entity_event_entity    ON entities.entity_event (entity_id, occurred_at);
CREATE INDEX idx_entity_event_type_time ON entities.entity_event (entity_type, event_type, occurred_at);
