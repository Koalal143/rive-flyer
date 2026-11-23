\getenv reader_password ANALYTICS_READER_PASSWORD

CREATE TABLE analytics_events (
    id uuid PRIMARY KEY,
    visit_id uuid NOT NULL,
    kind text NOT NULL,
    target text,
    duration_ms integer,
    qr_hash text,
    recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_time ON analytics_events (recorded_at);
CREATE UNIQUE INDEX analytics_visit_once ON analytics_events (visit_id) WHERE kind = 'visit';

CREATE ROLE analytics_reader LOGIN PASSWORD :'reader_password';
GRANT CONNECT ON DATABASE rivegauche_analytics TO analytics_reader;
GRANT USAGE ON SCHEMA public TO analytics_reader;
GRANT SELECT ON analytics_events TO analytics_reader;
