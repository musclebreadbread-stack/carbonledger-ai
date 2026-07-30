-- Supabase's auth schema, stubbed down to the surface these migrations touch.
CREATE SCHEMA IF NOT EXISTS auth;

-- The same definition Supabase ships: read JWT claims out of a GUC.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$ LANGUAGE sql STABLE;
