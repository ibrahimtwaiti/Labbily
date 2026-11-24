CREATE TABLE agent_limits (
 tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
 max_agents INTEGER NOT NULL DEFAULT 3, monthly_runs INTEGER NOT NULL DEFAULT 500,
 live_enabled INTEGER NOT NULL DEFAULT 0, external_enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE ai_agents (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 name TEXT NOT NULL, draft TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 published INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'draft',
 tested_revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
 UNIQUE(id,tenant_id)
);
CREATE TABLE agent_versions (
 tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, version INTEGER NOT NULL, config TEXT NOT NULL,
 created_at TEXT NOT NULL, PRIMARY KEY(agent_id,version),
 FOREIGN KEY(agent_id,tenant_id) REFERENCES ai_agents(id,tenant_id) ON DELETE CASCADE
);
CREATE TABLE agent_deployments (
 tenant_id TEXT NOT NULL, account_id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, mode TEXT NOT NULL,
 FOREIGN KEY(account_id,tenant_id) REFERENCES service_accounts(id,tenant_id) ON DELETE CASCADE,
 FOREIGN KEY(agent_id,tenant_id) REFERENCES ai_agents(id,tenant_id) ON DELETE CASCADE
);
CREATE TABLE agent_usage (
 tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE, month TEXT NOT NULL,
 runs INTEGER NOT NULL DEFAULT 0,input_tokens BIGINT NOT NULL DEFAULT 0,output_tokens BIGINT NOT NULL DEFAULT 0,
 PRIMARY KEY(tenant_id,month)
);
CREATE TABLE agent_runs (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, version INTEGER NOT NULL,
 ticket_id TEXT, inbound_id TEXT UNIQUE REFERENCES service_messages(id) ON DELETE CASCADE,
 note_id TEXT REFERENCES service_messages(id) ON DELETE SET NULL,
 task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
 result TEXT NOT NULL, source_title TEXT NOT NULL DEFAULT '', elapsed_ms INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 FOREIGN KEY(agent_id,tenant_id) REFERENCES ai_agents(id,tenant_id) ON DELETE CASCADE,
 FOREIGN KEY(ticket_id,tenant_id) REFERENCES service_tickets(id,tenant_id) ON DELETE CASCADE
);
CREATE INDEX agent_runs_tenant_time ON agent_runs(tenant_id,agent_id,created_at);
CREATE TABLE agent_scenarios (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, question TEXT NOT NULL, expected TEXT NOT NULL,
 FOREIGN KEY(agent_id,tenant_id) REFERENCES ai_agents(id,tenant_id) ON DELETE CASCADE
);
INSERT INTO schema_migrations(version,applied_at) VALUES(11,CURRENT_TIMESTAMP);
