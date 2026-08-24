ALTER TABLE query_traces
  ADD COLUMN sequence INTEGER NOT NULL DEFAULT 0;

CREATE INDEX query_traces_query_sequence_idx
  ON query_traces (query_id, sequence, rank);
