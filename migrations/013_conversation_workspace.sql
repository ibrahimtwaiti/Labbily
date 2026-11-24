ALTER TABLE service_tickets ADD COLUMN snoozed_until BIGINT NOT NULL DEFAULT 0;
CREATE TABLE inbox_seen (
 tenant_id TEXT NOT NULL, ticket_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 seen_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(ticket_id,user_id),
 FOREIGN KEY(ticket_id,tenant_id) REFERENCES service_tickets(id,tenant_id) ON DELETE CASCADE
);
CREATE TABLE inbox_views (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,criteria TEXT NOT NULL
);
CREATE INDEX inbox_views_user ON inbox_views(tenant_id,user_id);
CREATE INDEX service_messages_ticket_direction ON service_messages(ticket_id,direction,occurred_at);
INSERT INTO schema_migrations(version,applied_at) VALUES(12,CURRENT_TIMESTAMP);
