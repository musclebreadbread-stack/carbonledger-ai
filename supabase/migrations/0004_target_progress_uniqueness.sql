-- One progress row per target per year.
--
-- Required by the `target-progress-rollup` Edge Function, which upserts on
-- `(target_id, year)`. `ON CONFLICT` needs a unique constraint or index to
-- conflict *on*; without one the upsert is rejected outright by Postgres:
--
--   there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- So this is not an optimisation. Without it the scheduled job either cannot run
-- at all, or -- if written as a plain INSERT instead -- appends a second row for
-- the same year on every nightly run. `latestProgress` in
-- src/lib/targets/types.ts reduces over `progress` by year and would then be
-- picking arbitrarily between duplicates, so a company's reported progress would
-- depend on row order. That figure goes into CDP and SBTi submissions.
--
-- 0001 declares `target_progress` with no constraint on the pair, which is a gap
-- in the original schema rather than a deliberate allowance: two rows saying
-- different things about the same target and the same year cannot both be true.
--
-- A unique *index* rather than a table constraint, because `CREATE UNIQUE INDEX
-- IF NOT EXISTS` is idempotent and `ADD CONSTRAINT` is not; PostgREST's `upsert`
-- accepts either. Applied after 0001-0003 and touching none of them.
--
-- If an existing database already holds duplicates this will fail, loudly and
-- before writing anything, which is the right outcome: the duplicates have to be
-- reconciled by someone who knows which figure is correct. The query to find
-- them:
--
--   SELECT target_id, year, count(*) FROM target_progress
--   GROUP BY target_id, year HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "target_progress_target_id_year_key"
  ON target_progress ("target_id", "year");

-- Supports the `supplier-intake` lookup, which filters a request by `id`,
-- `company_id` and `supplier_id` together -- all three, because `service_role`
-- bypasses RLS and the function has to enforce tenancy itself. `id` is the
-- primary key so the lookup is already fast; this index is for the reminder job's
-- per-supplier grouping and for the portal listing a supplier's own requests,
-- neither of which has an index to use today.
CREATE INDEX IF NOT EXISTS "idx_supplier_data_requests_supplier_id"
  ON supplier_data_requests ("supplier_id");

-- The reminder job reads open requests ordered by company. Without this it is a
-- sequential scan of the whole table on every run.
CREATE INDEX IF NOT EXISTS "idx_supplier_data_requests_status_due_date"
  ON supplier_data_requests ("status", "due_date");
