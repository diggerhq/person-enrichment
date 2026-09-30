-- Isolated schema: this app never changes existing Neon application tables.
CREATE SCHEMA IF NOT EXISTS gtm_enrichment_demo;
CREATE TABLE IF NOT EXISTS gtm_enrichment_demo.requests (
  id uuid PRIMARY KEY,
  scope text NOT NULL,
  day date NOT NULL,
  ip_hash text NOT NULL,
  active_until timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_daily ON gtm_enrichment_demo.requests(scope, day);
CREATE INDEX IF NOT EXISTS requests_active ON gtm_enrichment_demo.requests(scope, ip_hash, active_until);
CREATE OR REPLACE FUNCTION gtm_enrichment_demo.reserve(request_id uuid, request_scope text, request_ip text)
RETURNS text LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  today date;
BEGIN
  -- All admissions in one scope serialize before checking either allowance.
  -- The lock is released automatically at the end of this transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended(request_scope, 0));
  today := (clock_timestamp() AT TIME ZONE 'UTC')::date;
  IF (SELECT count(*) FROM gtm_enrichment_demo.requests WHERE scope = request_scope AND day = today) >= 100 THEN
    RETURN 'daily_limit';
  END IF;
  IF (SELECT count(*) FROM gtm_enrichment_demo.requests WHERE scope = request_scope AND ip_hash = request_ip AND active_until > clock_timestamp()) >= 5 THEN
    RETURN 'ip_limit';
  END IF;
  DELETE FROM gtm_enrichment_demo.requests WHERE scope = request_scope AND day < today - 2;
  INSERT INTO gtm_enrichment_demo.requests VALUES (request_id, request_scope, today, request_ip, clock_timestamp() + interval '240 seconds');
  RETURN 'admitted';
END;
$$;
