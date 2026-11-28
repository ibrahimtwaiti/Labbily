CREATE TABLE task_priorities (
 task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
 priority TEXT NOT NULL CHECK(priority IN ('normal','high','low'))
);
CREATE TABLE contact_creation_runs (
 flow_id TEXT NOT NULL REFERENCES workspace_flows(id) ON DELETE CASCADE,
 contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL, position INTEGER NOT NULL, state TEXT NOT NULL, detail TEXT NOT NULL, created_at BIGINT NOT NULL,
 PRIMARY KEY(flow_id,contact_id)
);
CREATE INDEX contact_creation_history ON contact_creation_runs(flow_id,created_at);
CREATE TABLE workspace_campaigns (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 name TEXT NOT NULL, channel TEXT NOT NULL, segment_id TEXT REFERENCES contact_segments(id) ON DELETE SET NULL,
 body TEXT NOT NULL, planned_at TEXT, state TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL, UNIQUE(tenant_id,name)
);
INSERT INTO schema_migrations(version,applied_at) VALUES(17,CURRENT_TIMESTAMP);
