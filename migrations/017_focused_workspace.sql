ALTER TABLE service_accounts ADD COLUMN ai_paused INTEGER NOT NULL DEFAULT 0 CHECK(ai_paused IN (0,1));
CREATE TABLE contact_stages (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 UNIQUE (tenant_id,name)
);
CREATE TABLE contact_segments (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 filters TEXT NOT NULL,
 UNIQUE (tenant_id,name)
);
CREATE TABLE contact_profiles (
 contact_id TEXT PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
 stage TEXT NOT NULL,
 email TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL,
 blocked INTEGER NOT NULL DEFAULT 0 CHECK(blocked IN (0,1))
);
CREATE TABLE contact_stage_history (
 id TEXT PRIMARY KEY,
 contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
 stage TEXT NOT NULL,
 changed_at TEXT NOT NULL
);
CREATE INDEX contact_stage_timeline ON contact_stage_history(contact_id,changed_at,id);
CREATE INDEX contacts_workspace_page ON contacts(tenant_id,created_at,id);
CREATE INDEX inbox_workspace_page ON service_tickets(tenant_id,updated_at,id);
CREATE TABLE workspace_flows(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 name TEXT NOT NULL, trigger_type TEXT NOT NULL, draft TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 tested_revision INTEGER NOT NULL DEFAULT 0, published TEXT, published_revision INTEGER,
 active_trigger TEXT, UNIQUE(id,tenant_id)
);
CREATE UNIQUE INDEX workspace_flow_trigger ON workspace_flows(tenant_id,active_trigger) WHERE active_trigger<>'manual';
CREATE TABLE workspace_flow_runs(
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, flow_id TEXT NOT NULL,
 ticket_id TEXT NOT NULL, event_id TEXT NOT NULL,
 revision INTEGER NOT NULL, steps TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
 state TEXT NOT NULL, due_at BIGINT NOT NULL DEFAULT 0, detail TEXT NOT NULL DEFAULT '',
 created_at BIGINT NOT NULL, UNIQUE(flow_id,event_id,ticket_id),
 FOREIGN KEY(flow_id,tenant_id) REFERENCES workspace_flows(id,tenant_id) ON DELETE CASCADE,
 FOREIGN KEY(ticket_id,tenant_id) REFERENCES service_tickets(id,tenant_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX workspace_flow_active_ticket ON workspace_flow_runs(ticket_id) WHERE state IN ('queued','answer','dispatch');
CREATE INDEX workspace_flow_due ON workspace_flow_runs(state,due_at,id);
CREATE INDEX workspace_flow_ticket ON workspace_flow_runs(ticket_id,state);
INSERT INTO schema_migrations(version,applied_at) VALUES(16,CURRENT_TIMESTAMP);
