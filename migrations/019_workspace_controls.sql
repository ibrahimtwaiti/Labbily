CREATE TABLE campaign_images (
 campaign_id TEXT PRIMARY KEY REFERENCES workspace_campaigns(id) ON DELETE CASCADE,
 content TEXT NOT NULL
);
CREATE TABLE workspace_teams (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
 UNIQUE(tenant_id,name)
);
CREATE TABLE workspace_team_members (
 team_id TEXT NOT NULL REFERENCES workspace_teams(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(team_id,user_id)
);
CREATE TABLE workspace_fields (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, kind TEXT NOT NULL,
 UNIQUE(tenant_id,name)
);
CREATE TABLE contact_field_values (
 contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
 field_id TEXT NOT NULL REFERENCES workspace_fields(id) ON DELETE CASCADE, value TEXT NOT NULL,
 PRIMARY KEY(contact_id,field_id)
);
CREATE TABLE inbox_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, mentions INTEGER NOT NULL, quiet_start INTEGER, quiet_end INTEGER
);
CREATE TABLE wa_template_drafts (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, language TEXT NOT NULL,
 category TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(tenant_id,name,language)
);
INSERT INTO schema_migrations(version,applied_at) VALUES(18,CURRENT_TIMESTAMP);
