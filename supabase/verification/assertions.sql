-- Behavioural checks against the policies in 0003.
--
-- Everything runs as `app_user`, a non-owner role, because RLS is not applied to
-- superusers or table owners. Each check raises an exception on failure, so a
-- non-zero psql exit status means a policy is wrong.

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.check(label text, actual anyelement, expected anyelement)
RETURNS void AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL % : expected %, got %', label, expected, actual;
  END IF;
  RAISE NOTICE 'ok   %  (%)', label, actual;
END;
$$ LANGUAGE plpgsql;

-- JWT shapes. `user_metadata.company_id` and `.role` are what 0002's helpers read.
\set jwt_a_admin    '{"sub":"a0000000-0000-4000-8000-00000000000a","user_metadata":{"company_id":"aaaaaaaa-0000-4000-8000-000000000001","role":"company_admin"}}'
\set jwt_a_viewer   '{"sub":"a0000000-0000-4000-8000-00000000000b","user_metadata":{"company_id":"aaaaaaaa-0000-4000-8000-000000000001","role":"viewer"}}'
\set jwt_a_reviewer '{"sub":"a0000000-0000-4000-8000-00000000000c","user_metadata":{"company_id":"aaaaaaaa-0000-4000-8000-000000000001","role":"reviewer"}}'
\set jwt_b_admin    '{"sub":"b0000000-0000-4000-8000-00000000000a","user_metadata":{"company_id":"bbbbbbbb-0000-4000-8000-000000000001","role":"company_admin"}}'

-- ============================================================
-- 1. Every governed table is company-scoped on read
-- ============================================================
SET ROLE app_user;
SET request.jwt.claims TO :'jwt_a_admin';

SELECT pg_temp.check('production_lines visible',          (SELECT count(*) FROM production_lines), 1::bigint);
SELECT pg_temp.check('equipment visible',                 (SELECT count(*) FROM equipment), 1::bigint);
SELECT pg_temp.check('emission_sources visible',          (SELECT count(*) FROM emission_sources), 1::bigint);
SELECT pg_temp.check('attachments visible',               (SELECT count(*) FROM emission_record_attachments), 1::bigint);
SELECT pg_temp.check('scope3_records visible',            (SELECT count(*) FROM scope3_records), 1::bigint);
SELECT pg_temp.check('supplier_emissions visible',        (SELECT count(*) FROM supplier_emissions), 1::bigint);
SELECT pg_temp.check('supplier_data_requests visible',    (SELECT count(*) FROM supplier_data_requests), 1::bigint);
SELECT pg_temp.check('workflow_instances visible',        (SELECT count(*) FROM workflow_instances), 1::bigint);
SELECT pg_temp.check('workflow_steps visible',            (SELECT count(*) FROM workflow_steps), 2::bigint);
SELECT pg_temp.check('target_progress visible',           (SELECT count(*) FROM target_progress), 1::bigint);

-- The rows that are visible are A's, not merely "one row".
SELECT pg_temp.check('scope3_records is A''s row',
  (SELECT company_id FROM scope3_records), 'aaaaaaaa-0000-4000-8000-000000000001'::uuid);
SELECT pg_temp.check('supplier_emissions is A''s row',
  (SELECT company_id FROM supplier_emissions), 'aaaaaaaa-0000-4000-8000-000000000001'::uuid);
SELECT pg_temp.check('target_progress is A''s row',
  (SELECT actual_emissions FROM target_progress), 12760::numeric);
SELECT pg_temp.check('equipment is A''s row', (SELECT name FROM equipment), 'A Boiler');

-- ============================================================
-- 2. The other tenant's rows are invisible, and unreachable by id
-- ============================================================
SELECT pg_temp.check('B scope3_record not readable by id',
  (SELECT count(*) FROM scope3_records WHERE id = 'b8000000-0000-4000-8000-000000000001'), 0::bigint);
SELECT pg_temp.check('B supplier_emissions not readable by id',
  (SELECT count(*) FROM supplier_emissions WHERE id = 'ba000000-0000-4000-8000-000000000001'), 0::bigint);
SELECT pg_temp.check('B workflow_step not readable by id',
  (SELECT count(*) FROM workflow_steps WHERE id = 'c1000000-1111-4000-8000-000000000003'), 0::bigint);
SELECT pg_temp.check('B target_progress not readable by id',
  (SELECT count(*) FROM target_progress WHERE id = 'bd000000-0000-4000-8000-000000000001'), 0::bigint);
SELECT pg_temp.check('B attachment not readable by id',
  (SELECT count(*) FROM emission_record_attachments WHERE id = 'b7000000-0000-4000-8000-000000000001'), 0::bigint);

-- ============================================================
-- 3. Cross-tenant writes affect nothing
-- ============================================================
-- UPDATE and DELETE against an invisible row are no-ops rather than errors,
-- which is the correct RLS behaviour: the row simply is not there.
WITH updated AS (
  UPDATE scope3_records SET co2e_kg = 1
  WHERE id = 'b8000000-0000-4000-8000-000000000001' RETURNING 1
)
SELECT pg_temp.check('cross-tenant scope3 UPDATE is a no-op',
  (SELECT count(*) FROM updated), 0::bigint);

WITH deleted AS (
  DELETE FROM target_progress
  WHERE id = 'bd000000-0000-4000-8000-000000000001' RETURNING 1
)
SELECT pg_temp.check('cross-tenant target_progress DELETE is a no-op',
  (SELECT count(*) FROM deleted), 0::bigint);

WITH updated AS (
  UPDATE supplier_emissions SET co2e_kg = 1
  WHERE id = 'ba000000-0000-4000-8000-000000000001' RETURNING 1
)
SELECT pg_temp.check('cross-tenant supplier_emissions UPDATE is a no-op',
  (SELECT count(*) FROM updated), 0::bigint);

-- Inserting a row *labelled* as another tenant's must be refused outright.
DO $$
BEGIN
  INSERT INTO scope3_records (company_id, category_number, period_start, period_end, co2e_kg)
  VALUES ('bbbbbbbb-0000-4000-8000-000000000001', 2, '2024-01-01', '2024-12-31', 1);
  RAISE EXCEPTION 'FAIL scope3_records INSERT for another tenant was allowed';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   scope3_records INSERT for another tenant refused';
END $$;

DO $$
BEGIN
  INSERT INTO equipment (line_id, name, type)
  VALUES ('b3000000-0000-4000-8000-000000000001', 'Smuggled', 'boiler');
  RAISE EXCEPTION 'FAIL equipment INSERT onto another tenant''s line was allowed';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   equipment INSERT onto another tenant''s line refused';
END $$;

-- ============================================================
-- 4. A write is allowed inside the tenant
-- ============================================================
INSERT INTO scope3_records (company_id, category_number, period_start, period_end, co2e_kg)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 3, '2024-01-01', '2024-12-31', 5);
SELECT pg_temp.check('own-tenant scope3 INSERT allowed',
  (SELECT count(*) FROM scope3_records), 2::bigint);
DELETE FROM scope3_records WHERE category_number = 3;

INSERT INTO target_progress (target_id, year, actual_emissions)
VALUES ('ac000000-0000-4000-8000-000000000001', 2023, 13760);
SELECT pg_temp.check('own-tenant target_progress INSERT allowed',
  (SELECT count(*) FROM target_progress), 2::bigint);
DELETE FROM target_progress WHERE year = 2023;

-- ============================================================
-- 5. Read-only roles cannot write
-- ============================================================
SET request.jwt.claims TO :'jwt_a_viewer';

SELECT pg_temp.check('viewer can still read scope3_records',
  (SELECT count(*) FROM scope3_records), 1::bigint);

DO $$
BEGIN
  INSERT INTO scope3_records (company_id, category_number, period_start, period_end, co2e_kg)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 4, '2024-01-01', '2024-12-31', 1);
  RAISE EXCEPTION 'FAIL viewer was allowed to insert a scope3_record';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   viewer INSERT on scope3_records refused';
END $$;

WITH deleted AS (
  DELETE FROM target_progress
  WHERE id = 'ad000000-0000-4000-8000-000000000001' RETURNING 1
)
SELECT pg_temp.check('viewer DELETE on target_progress is a no-op',
  (SELECT count(*) FROM deleted), 0::bigint);

-- ============================================================
-- 6. Approval trail: a completed, signed step is frozen
-- ============================================================
SET request.jwt.claims TO :'jwt_a_reviewer';

-- The assignee may act on their open step.
WITH updated AS (
  UPDATE workflow_steps SET action = 'approve', comment = 'looks right'
  WHERE id = 'c1000000-1111-4000-8000-000000000001' RETURNING 1
)
SELECT pg_temp.check('assignee may update their open step',
  (SELECT count(*) FROM updated), 1::bigint);

-- The completed, signed step is not updatable by anyone, assignee included.
WITH updated AS (
  UPDATE workflow_steps SET digital_signature = 'forged'
  WHERE id = 'c1000000-1111-4000-8000-000000000002' RETURNING 1
)
SELECT pg_temp.check('completed step cannot be re-signed',
  (SELECT count(*) FROM updated), 0::bigint);

-- Reassigning a step to someone else while updating it is refused.
DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE workflow_steps
  SET assignee_id = 'a0000000-0000-4000-8000-00000000000b'
  WHERE id = 'c1000000-1111-4000-8000-000000000001';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE EXCEPTION 'FAIL step reassignment was allowed (% rows)', affected;
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   step reassignment refused by WITH CHECK';
END $$;

-- No DELETE policy exists on workflow_steps at all.
WITH deleted AS (
  DELETE FROM workflow_steps
  WHERE id = 'c1000000-1111-4000-8000-000000000001' RETURNING 1
)
SELECT pg_temp.check('no one can delete an approval step',
  (SELECT count(*) FROM deleted), 0::bigint);

-- Starting an approval is a write, not a review action, so a reviewer cannot
-- open one. That is deliberate: the person who submits a record opens its
-- workflow, and the reviewer decides on it.
DO $$
BEGIN
  INSERT INTO workflow_instances (definition_id, record_type, record_id, created_by)
  VALUES ('ae000000-0000-4000-8000-000000000001', 'emission_record',
          'a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000c');
  RAISE EXCEPTION 'FAIL a reviewer opened a workflow instance';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   reviewer cannot open a workflow instance';
END $$;

-- A writer may open one, but only in their own name.
SET request.jwt.claims TO :'jwt_a_admin';

DO $$
BEGIN
  INSERT INTO workflow_instances (definition_id, record_type, record_id, created_by)
  VALUES ('ae000000-0000-4000-8000-000000000001', 'emission_record',
          'a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000c');
  RAISE EXCEPTION 'FAIL workflow instance attributed to another user was allowed';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   workflow instance misattribution refused';
END $$;

INSERT INTO workflow_instances (definition_id, record_type, record_id, created_by)
VALUES ('ae000000-0000-4000-8000-000000000001', 'emission_record',
        'a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a');
SELECT pg_temp.check('workflow instance in the caller''s own name allowed',
  (SELECT count(*) FROM workflow_instances), 2::bigint);

-- And it cannot be removed afterwards: an approval that ran is a fact.
WITH deleted AS (
  DELETE FROM workflow_instances
  WHERE definition_id = 'ae000000-0000-4000-8000-000000000001' RETURNING 1
)
SELECT pg_temp.check('workflow instances cannot be deleted',
  (SELECT count(*) FROM deleted), 0::bigint);

-- ============================================================
-- 7. Permission table: nobody grants themselves access
-- ============================================================
SET request.jwt.claims TO :'jwt_a_viewer';

SELECT pg_temp.check('a user sees their own site grant',
  (SELECT count(*) FROM user_site_access), 1::bigint);

DO $$
BEGIN
  INSERT INTO user_site_access (user_id, site_id, can_write)
  VALUES ('a0000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000001', true);
  RAISE EXCEPTION 'FAIL a viewer granted themselves write access';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   self-granted site access refused';
END $$;

SET request.jwt.claims TO :'jwt_a_admin';
SELECT pg_temp.check('an admin sees every grant in their company',
  (SELECT count(*) FROM user_site_access), 1::bigint);

-- An admin may not hand one of their users a foothold in another tenant's site.
DO $$
BEGIN
  INSERT INTO user_site_access (user_id, site_id, can_write)
  VALUES ('a0000000-0000-4000-8000-00000000000b', 'b1000000-0000-4000-8000-000000000001', true);
  RAISE EXCEPTION 'FAIL admin granted access to another tenant''s site';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   grant onto another tenant''s site refused';
END $$;

-- ============================================================
-- 8. Reference data: readable by all, writable by the platform only
-- ============================================================
SELECT pg_temp.check('scope3_categories readable',
  (SELECT count(*) FROM scope3_categories), 1::bigint);
SELECT pg_temp.check('unit_conversions readable',
  (SELECT count(*) FROM unit_conversions), 1::bigint);
SELECT pg_temp.check('emission_factor_sets readable',
  (SELECT count(*) FROM emission_factor_sets), 1::bigint);

DO $$
BEGIN
  INSERT INTO unit_conversions (from_unit, to_unit, conversion_factor, category)
  VALUES ('t', 'kg', 1000, 'mass');
  RAISE EXCEPTION 'FAIL a company_admin altered global unit conversions';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   company_admin write on unit_conversions refused';
END $$;

DO $$
BEGIN
  INSERT INTO scope3_categories (category_number, name) VALUES (2, 'Capital goods');
  RAISE EXCEPTION 'FAIL a company_admin altered the GHG Protocol category list';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'ok   company_admin write on scope3_categories refused';
END $$;

SET request.jwt.claims TO '{"sub":"00000000-0000-4000-8000-000000000000","user_metadata":{"role":"super_admin"}}';
INSERT INTO scope3_categories (category_number, name) VALUES (2, 'Capital goods');
SELECT pg_temp.check('super_admin may extend reference data',
  (SELECT count(*) FROM scope3_categories), 2::bigint);

-- ============================================================
-- 9. The other tenant sees its own rows, mirror image
-- ============================================================
SET request.jwt.claims TO :'jwt_b_admin';
SELECT pg_temp.check('B sees only its scope3_record',
  (SELECT company_id FROM scope3_records), 'bbbbbbbb-0000-4000-8000-000000000001'::uuid);
SELECT pg_temp.check('B sees only its equipment', (SELECT name FROM equipment), 'B Boiler');
SELECT pg_temp.check('B sees only its workflow step',
  (SELECT count(*) FROM workflow_steps), 1::bigint);
SELECT pg_temp.check('B sees only its target progress',
  (SELECT actual_emissions FROM target_progress), 41000::numeric);

-- ============================================================
-- 10. No JWT at all: an anonymous session sees no tenant data
-- ============================================================
RESET request.jwt.claims;
SELECT pg_temp.check('anonymous sees no scope3_records',
  (SELECT count(*) FROM scope3_records), 0::bigint);
SELECT pg_temp.check('anonymous sees no supplier_emissions',
  (SELECT count(*) FROM supplier_emissions), 0::bigint);
SELECT pg_temp.check('anonymous sees no workflow_steps',
  (SELECT count(*) FROM workflow_steps), 0::bigint);
SELECT pg_temp.check('anonymous sees no target_progress',
  (SELECT count(*) FROM target_progress), 0::bigint);
SELECT pg_temp.check('anonymous sees no equipment',
  (SELECT count(*) FROM equipment), 0::bigint);
SELECT pg_temp.check('anonymous sees no user_site_access',
  (SELECT count(*) FROM user_site_access), 0::bigint);

RESET ROLE;

-- ============================================================
-- 11. Coverage: no table in public is left without a policy
-- ============================================================
SELECT pg_temp.check(
  'every table has RLS enabled',
  (SELECT count(*) FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
   WHERE t.schemaname = 'public' AND NOT c.relrowsecurity),
  0::bigint);

SELECT pg_temp.check(
  'every table has at least one policy',
  (SELECT count(*) FROM pg_tables t
   WHERE t.schemaname = 'public'
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies p
       WHERE p.schemaname = 'public' AND p.tablename = t.tablename
     )),
  0::bigint);
