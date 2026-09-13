-- Run this once against your Tiger Data database.
-- This is the one new table the Express backend owns.
-- It does not touch anything in Supabase.

CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  item TEXT NOT NULL,
  category TEXT,
  price NUMERIC(12, 2),
  decision TEXT NOT NULL, -- "bought" or "not needed yet"
  alternatives JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchases_user_id_idx ON purchases (user_id);
CREATE INDEX IF NOT EXISTS purchases_created_at_idx ON purchases (created_at);
