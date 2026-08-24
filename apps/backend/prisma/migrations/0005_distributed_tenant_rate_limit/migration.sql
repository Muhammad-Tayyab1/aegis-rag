CREATE TABLE tenant_rate_limit_windows (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0)
);

ALTER TABLE tenant_rate_limit_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_rate_limit_windows_isolation
  ON tenant_rate_limit_windows
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON tenant_rate_limit_windows TO aegis_runtime;
