ALTER TABLE connectors DROP CONSTRAINT IF EXISTS connectors_type_check;
ALTER TABLE connectors
  ADD CONSTRAINT connectors_type_check CHECK (type IN ('rest', 'postgres', 'crawler'));
