CREATE TABLE agent_jobs (
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 run_id TEXT NOT NULL UNIQUE REFERENCES agent_runs(id) ON DELETE CASCADE,
 ticket_version INTEGER NOT NULL, job_type TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
 claimed_at BIGINT NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt BIGINT NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
);
CREATE INDEX agent_jobs_pending ON agent_jobs(state,next_attempt,created_at);
CREATE TABLE agent_connections (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, kind TEXT NOT NULL,
 endpoint TEXT NOT NULL,ciphertext TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(tenant_id,kind)
);
INSERT INTO schema_migrations(version,applied_at) VALUES(13,CURRENT_TIMESTAMP);
