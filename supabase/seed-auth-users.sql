-- Credentials for the five test accounts, for a real Supabase project.
--
-- `supabase/seed.sql` inserts the five rows into `public.users`, but on a real
-- project `public.users.id` is `auth.users.id` and nothing can sign in until the
-- matching `auth.users` rows exist. That is what this file creates. It is separate
-- from seed.sql on purpose: `supabase db reset` runs seed.sql automatically, and a
-- file that writes into the `auth` schema has no business running against the plain
-- Postgres container that `docker-compose.yml` and `supabase/verification/run.sh`
-- use — neither has a real `auth.users` table.
--
-- Apply it only against a Supabase project, after the migrations and seed.sql:
--
--     psql "$DATABASE_URL" -f supabase/seed-auth-users.sql
--
-- or paste it into the SQL editor in the Supabase dashboard.
--
-- The password is the one printed on the sign-in screen and in
-- docs/test-accounts.md. These are demonstration accounts on demonstration data;
-- if this is applied to anything reachable from the internet, change the password
-- below first and change it in `src/lib/auth/test-accounts.ts` to match, or delete
-- the rows again when the walkthrough is over.
--
-- `raw_user_meta_data` carries the three claims the app reads from the JWT —
-- `company_id`, `role` and `full_name`. See `getCurrentActor` in
-- src/lib/auth/current-actor.ts: without `company_id` the actor resolves to null
-- and every action is refused, and without `role` it falls back to `viewer`.
--
-- Idempotent: re-running updates the password and the claims rather than failing on
-- the primary key, so it can be re-applied after `supabase db reset`.

-- pgcrypto provides crypt()/gen_salt(); Supabase enables it in the `extensions`
-- schema by default, but a self-hosted project may not have it yet.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  test_password text := 'CarbonLedger!2024';
  -- Must match `companies.id` in supabase/seed.sql. This is NOT the
  -- SAMPLE_COMPANY_ID the demo path uses: that constant only applies when there is
  -- no database, and the two are different tenants by design.
  company uuid := '11111111-1111-1111-1111-111111111111';
  account record;
BEGIN
  FOR account IN
    SELECT *
    FROM (
      VALUES
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'::uuid, 'admin@hankook-mfg.co.kr',      '김관리', 'company_admin'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'::uuid, 'site-admin@hankook-mfg.co.kr', '이현장', 'site_admin'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003'::uuid, 'reviewer@hankook-mfg.co.kr',   '박검토', 'reviewer'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa004'::uuid, 'auditor@hankook-mfg.co.kr',    '정감사', 'auditor'),
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa005'::uuid, 'viewer@hankook-mfg.co.kr',     '최열람', 'viewer')
    ) AS t(id, email, full_name, role)
  LOOP
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      -- Set so the account is usable immediately; leaving it null makes Supabase
      -- refuse the sign-in until a confirmation link nobody will receive is
      -- clicked.
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      account.id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      account.email,
      crypt(test_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object(
        'company_id', company::text,
        'role', account.role,
        'full_name', account.full_name
      ),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE
      SET encrypted_password = EXCLUDED.encrypted_password,
          email              = EXCLUDED.email,
          email_confirmed_at = EXCLUDED.email_confirmed_at,
          raw_user_meta_data = EXCLUDED.raw_user_meta_data,
          updated_at         = now();

    -- Supabase's GoTrue expects an `identities` row per provider; without it the
    -- account exists but password sign-in reports "Invalid login credentials".
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      account.id,
      account.id::text,
      'email',
      jsonb_build_object('sub', account.id::text, 'email', account.email, 'email_verified', true),
      now(),
      now(),
      now()
    )
    ON CONFLICT (provider_id, provider) DO UPDATE
      SET identity_data = EXCLUDED.identity_data,
          updated_at    = now();
  END LOOP;
END
$$;
