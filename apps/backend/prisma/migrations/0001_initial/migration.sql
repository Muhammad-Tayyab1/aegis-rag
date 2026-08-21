CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'ready', 'failed');

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tenant_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  chunk_size INTEGER NOT NULL DEFAULT 800 CHECK (chunk_size BETWEEN 100 AND 5000),
  chunk_overlap INTEGER NOT NULL DEFAULT 100 CHECK (chunk_overlap BETWEEN 0 AND 1000),
  embedding_model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  retrieval_strategy TEXT NOT NULL DEFAULT 'hybrid' CHECK (retrieval_strategy IN ('vector', 'keyword', 'hybrid')),
  rerank_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  source_uri TEXT,
  status document_status NOT NULL DEFAULT 'pending',
  content_hash TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384),
  tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, ordinal)
);
CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE query_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  chunk_id UUID REFERENCES chunks(id) ON DELETE SET NULL,
  rank INTEGER,
  score NUMERIC,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(query_id)
);
CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('rest', 'postgres')), config JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  query_id UUID REFERENCES queries(id) ON DELETE SET NULL, summary TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')), status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE semantic_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question TEXT NOT NULL, answer TEXT NOT NULL, citations JSONB NOT NULL DEFAULT '[]'::jsonb, embedding vector(384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX chunks_tenant_document_idx ON chunks (tenant_id, document_id);
CREATE INDEX chunks_tsv_idx ON chunks USING GIN (tsv);
CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX documents_tenant_idx ON documents (tenant_id, uploaded_at DESC);
CREATE INDEX queries_tenant_created_idx ON queries (tenant_id, created_at DESC);
CREATE INDEX query_traces_query_idx ON query_traces (query_id, created_at);
CREATE INDEX connectors_tenant_idx ON connectors (tenant_id, created_at DESC);
CREATE INDEX tickets_tenant_idx ON tickets (tenant_id, created_at DESC);
CREATE INDEX semantic_cache_lookup_idx ON semantic_cache USING hnsw (embedding vector_cosine_ops);

-- Defense in depth: every tenant-owned table uses the tenant id set per transaction by PrismaService.
ALTER TABLE tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_config_isolation ON tenant_config USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY users_isolation ON users USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY documents_isolation ON documents USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY chunks_isolation ON chunks USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY queries_isolation ON queries USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY query_traces_isolation ON query_traces USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY feedback_isolation ON feedback USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY connectors_isolation ON connectors USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY tickets_isolation ON tickets USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
CREATE POLICY semantic_cache_isolation ON semantic_cache USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

INSERT INTO tenants (id, name, slug, plan) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Aegis Demo', 'aegis-demo', 'pro'),
  ('22222222-2222-4222-8222-222222222222', 'Northwind Research', 'northwind', 'starter');
INSERT INTO tenant_config (tenant_id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
