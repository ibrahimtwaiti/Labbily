ALTER TABLE agent_jobs ADD COLUMN approved_connection TEXT NOT NULL DEFAULT '';
INSERT INTO schema_migrations(version,applied_at) VALUES(15,CURRENT_TIMESTAMP);
