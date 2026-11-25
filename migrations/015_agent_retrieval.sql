ALTER TABLE agent_documents ADD COLUMN sync_hours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_documents ADD COLUMN next_sync BIGINT NOT NULL DEFAULT 0;
ALTER TABLE agent_documents ADD COLUMN sync_error TEXT NOT NULL DEFAULT '';
ALTER TABLE agent_documents ADD COLUMN index_state TEXT NOT NULL DEFAULT 'none';
ALTER TABLE agent_documents ADD COLUMN index_after BIGINT NOT NULL DEFAULT 0;
ALTER TABLE agent_documents ADD COLUMN index_model TEXT NOT NULL DEFAULT '';
CREATE TABLE agent_vectors(
 tenant_id TEXT NOT NULL,document_id TEXT NOT NULL,checksum TEXT NOT NULL,model TEXT NOT NULL,
 chunk_index INTEGER NOT NULL,embedding TEXT NOT NULL,
 PRIMARY KEY(document_id,checksum,model,chunk_index),
 FOREIGN KEY(document_id,tenant_id) REFERENCES agent_documents(id,tenant_id) ON DELETE CASCADE
);
CREATE TABLE agent_meter(
 id TEXT PRIMARY KEY,tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
 operation TEXT NOT NULL,model TEXT NOT NULL,input_tokens INTEGER NOT NULL,output_tokens INTEGER NOT NULL,
 estimated_usd TEXT,created_at TEXT NOT NULL
);
CREATE INDEX agent_meter_by_month ON agent_meter(tenant_id,created_at);
INSERT INTO schema_migrations(version,applied_at) VALUES(14,CURRENT_TIMESTAMP);
