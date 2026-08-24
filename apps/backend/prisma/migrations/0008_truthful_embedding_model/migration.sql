ALTER TABLE tenant_config
  ALTER COLUMN embedding_model SET DEFAULT 'aegis-hash-384';

UPDATE tenant_config
SET embedding_model = 'aegis-hash-384', updated_at = now()
WHERE embedding_model = 'all-MiniLM-L6-v2';
