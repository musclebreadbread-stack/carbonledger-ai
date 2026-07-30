-- Row Level Security, phase 2: the tables 0002 left uncovered.
--
-- 0001_initial_schema.sql creates 25 tables. 0002_rls_policies.sql enables RLS on
-- 14 of them and writes policies for 11. That leaves fourteen tables without a
-- single policy, in two distinct and differently dangerous states:
--
--   (a) RLS enabled, no policy -> deny-all. `production_lines`, `equipment` and
--       `emission_sources`. Nothing but the service role can read them, so the
--       asset hierarchy and the emission source register are invisible to the
--       application. A availability bug, not a leak.
--
--   (b) RLS never enabled -> wide open. `user_site_access`, `emission_factor_sets`,
--       `emission_record_attachments`, `scope3_categories`, `scope3_records`,
--       `supplier_emissions`, `workflow_instances`, `workflow_steps`,
--       `supplier_data_requests`, `target_progress` and `unit_conversions`.
--       Supabase grants the `anon` and `authenticated` roles table privileges by
--       default, so with RLS off every tenant's Scope 3 records, supplier
--       emissions, approval trails and target progress are readable across the
--       tenant boundary. This is the actual multi-tenant leak, and it sits under
--       exactly the five tables the new UI pages read from.
--
-- 0001 and 0002 are verified as applying cleanly in order and are not touched.
--
-- Conventions inherited from 0002 on purpose rather than reinvented:
--   * tenancy comes from `auth.user_company_id()`, role from `auth.user_role()`,
--     both reading the JWT's `user_metadata`. One source of truth beats two.
--   * new helpers also live in the `auth` schema. Supabase's guidance is to keep
--     application objects out of `auth` because the platform manages it, and that
--     guidance is right -- but 0002 already put both helpers there, so a second
--     convention would be worse than the risk of a third function sharing the
--     first two's fate.
--   * `service_role` has BYPASSRLS in Supabase, so server-side jobs need no
--     policy of their own and none is written here.
--
-- Role capabilities, per docs/admin-manual.md:
--   super_admin    platform-wide, all operations
--   company_admin  full company management: read, write, approve, admin, export
--   site_admin     site-level operations: read, write, approve, export
--   reviewer       read, approve, export
--   auditor        read, audit, export
--   viewer         read only
--   consultant     read, export
-- So: reads are company-wide (auditor, viewer and consultant included), writes
-- stop at site_admin, approvals reach reviewer, and destructive operations stop
-- at company_admin.

-- ============================================================
-- ENABLE RLS on everything 0002 missed
-- ============================================================
-- Idempotent, and safe to run against the three tables that already have it on.
ALTER TABLE user_site_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_factor_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_record_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope3_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope3_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_data_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE target_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_sources ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPERS
-- ============================================================

-- The authenticated user's id, taken from the JWT `sub` claim.
--
-- Equivalent to Supabase's own `auth.uid()`, but derived from `auth.jwt()` so
-- this migration depends on nothing 0002 did not already depend on.
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS uuid AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')::uuid;
$$ LANGUAGE sql STABLE;

-- Capability predicates.
--
-- Named after the capability rather than spelled out as a role list at thirty
-- call sites: adding a role later is one edit here instead of a search for every
-- `IN ('super_admin', ...)` that happens to be the right one.

-- Delete, and anything else that destroys or reassigns data.
CREATE OR REPLACE FUNCTION auth.can_administer()
RETURNS boolean AS $$
  SELECT auth.user_role() IN ('super_admin', 'company_admin');
$$ LANGUAGE sql STABLE;

-- Create and edit inventory data.
CREATE OR REPLACE FUNCTION auth.can_write()
RETURNS boolean AS $$
  SELECT auth.user_role() IN ('super_admin', 'company_admin', 'site_admin');
$$ LANGUAGE sql STABLE;

-- Approve, verify, reject: the review actions, which reviewers hold too.
CREATE OR REPLACE FUNCTION auth.can_approve()
RETURNS boolean AS $$
  SELECT auth.user_role() IN ('super_admin', 'company_admin', 'site_admin', 'reviewer');
$$ LANGUAGE sql STABLE;

-- Ownership predicates for the tables that reach their `company_id` through a
-- foreign key instead of holding one.
--
-- `SECURITY DEFINER` with a pinned empty `search_path`, which is the hardened
-- form Supabase documents:
--   * DEFINER so the answer does not depend on the parent table's own policies.
--     Without it, `equipment` would silently widen or narrow whenever someone
--     edited the `sites` policy, and a future policy cycle would recurse.
--   * an empty `search_path` with every name fully qualified, so the function
--     cannot be hijacked by a caller-controlled `search_path`.
-- Each takes only a row's own foreign key and returns a boolean about the
-- caller's own company, so bypassing RLS inside them leaks nothing: there is no
-- argument a caller can pass that reveals another tenant's data.

CREATE OR REPLACE FUNCTION auth.company_owns_site(site uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sites s
    WHERE s.id = site AND s.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION auth.company_owns_facility(facility uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.facilities f
    JOIN public.sites s ON s.id = f.site_id
    WHERE f.id = facility AND s.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION auth.company_owns_production_line(line uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.production_lines l
    JOIN public.facilities f ON f.id = l.facility_id
    JOIN public.sites s ON s.id = f.site_id
    WHERE l.id = line AND s.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION auth.company_owns_emission_record(record uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.emission_records r
    WHERE r.id = record AND r.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION auth.company_owns_workflow_definition(definition uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workflow_definitions d
    WHERE d.id = definition AND d.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION auth.company_owns_workflow_instance(instance uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workflow_instances i
    JOIN public.workflow_definitions d ON d.id = i.definition_id
    WHERE i.id = instance AND d.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION auth.company_owns_reduction_target(target uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reduction_targets t
    WHERE t.id = target AND t.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION auth.company_owns_user(subject uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = subject AND u.company_id = auth.user_company_id()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- ============================================================
-- ASSET HIERARCHY: production_lines, equipment
-- ============================================================
-- Both had RLS enabled by 0002 and no policy, so both were deny-all. Neither
-- carries a company_id; ownership is reached through facilities -> sites.

CREATE POLICY "company_view_production_lines" ON production_lines
  FOR SELECT USING (auth.company_owns_facility(facility_id));

CREATE POLICY "writer_manage_production_lines" ON production_lines
  FOR ALL USING (auth.company_owns_facility(facility_id) AND auth.can_write());

CREATE POLICY "company_view_equipment" ON equipment
  FOR SELECT USING (auth.company_owns_production_line(line_id));

CREATE POLICY "writer_manage_equipment" ON equipment
  FOR ALL USING (auth.company_owns_production_line(line_id) AND auth.can_write());

-- ============================================================
-- EMISSION SOURCES
-- ============================================================
-- The source register. Company-scoped directly. Deletion is restricted to
-- administrators because emission_records reference sources: dropping a source
-- rewrites the provenance of every record that pointed at it.

CREATE POLICY "company_view_emission_sources" ON emission_sources
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "writer_create_emission_sources" ON emission_sources
  FOR INSERT WITH CHECK (company_id = auth.user_company_id() AND auth.can_write());

CREATE POLICY "writer_update_emission_sources" ON emission_sources
  FOR UPDATE USING (company_id = auth.user_company_id() AND auth.can_write());

CREATE POLICY "admin_delete_emission_sources" ON emission_sources
  FOR DELETE USING (company_id = auth.user_company_id() AND auth.can_administer());

-- ============================================================
-- EMISSION RECORD ATTACHMENTS
-- ============================================================
-- Evidence files backing an emission record. Scoped through the record.
--
-- No UPDATE policy, deliberately. An attachment row is a pointer to an uploaded
-- file; allowing `file_url` to be rewritten while the row id stays the same would
-- let evidence be swapped underneath an approved record without leaving a trace.
-- Replacing evidence means inserting a new attachment and deleting the old one,
-- both of which are visible operations.

CREATE POLICY "company_view_attachments" ON emission_record_attachments
  FOR SELECT USING (auth.company_owns_emission_record(record_id));

CREATE POLICY "writer_create_attachments" ON emission_record_attachments
  FOR INSERT WITH CHECK (
    auth.company_owns_emission_record(record_id)
    AND auth.can_write()
  );

CREATE POLICY "admin_delete_attachments" ON emission_record_attachments
  FOR DELETE USING (
    auth.company_owns_emission_record(record_id)
    AND auth.can_administer()
  );

-- ============================================================
-- SCOPE 3 RECORDS
-- ============================================================
-- Value chain emissions, company-scoped. Mirrors the emission_records split in
-- 0002: reviewers may correct a submitted figure, only administrators may delete.

CREATE POLICY "company_view_scope3_records" ON scope3_records
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "writer_create_scope3_records" ON scope3_records
  FOR INSERT WITH CHECK (company_id = auth.user_company_id() AND auth.can_write());

CREATE POLICY "writer_update_scope3_records" ON scope3_records
  FOR UPDATE USING (company_id = auth.user_company_id() AND auth.can_approve());

CREATE POLICY "admin_delete_scope3_records" ON scope3_records
  FOR DELETE USING (company_id = auth.user_company_id() AND auth.can_administer());

-- ============================================================
-- SUPPLIER EMISSIONS
-- ============================================================
-- Primary data submitted by suppliers, company-scoped.
--
-- The reporting company owns these rows: a supplier submits through
-- supplier_data_requests, and verification promotes the figure into
-- supplier_emissions. Verification is a review action, so `can_approve` covers
-- UPDATE. Suppliers themselves are not users of this system and hold no JWT, so
-- there is no supplier-side policy to write; when a supplier portal login exists
-- it will need its own policy keyed on the supplier, not a widening of these.

CREATE POLICY "company_view_supplier_emissions" ON supplier_emissions
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "writer_create_supplier_emissions" ON supplier_emissions
  FOR INSERT WITH CHECK (company_id = auth.user_company_id() AND auth.can_write());

CREATE POLICY "reviewer_update_supplier_emissions" ON supplier_emissions
  FOR UPDATE USING (company_id = auth.user_company_id() AND auth.can_approve());

CREATE POLICY "admin_delete_supplier_emissions" ON supplier_emissions
  FOR DELETE USING (company_id = auth.user_company_id() AND auth.can_administer());

-- ============================================================
-- SUPPLIER DATA REQUESTS
-- ============================================================
-- The request lifecycle: pending -> sent -> in_progress -> submitted ->
-- verified | rejected. Verification and rejection are review actions.
--
-- No DELETE policy. A rejected request is superseded by a new one rather than
-- reopened (see `reRequest` in src/lib/suppliers/types.ts), which only works as
-- an audit trail if the rejected attempt survives. Deleting the chain would also
-- break the de-duplication rule that stops a re-requested figure being counted
-- twice in the Scope 3 roll-up.

CREATE POLICY "company_view_supplier_requests" ON supplier_data_requests
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "writer_create_supplier_requests" ON supplier_data_requests
  FOR INSERT WITH CHECK (company_id = auth.user_company_id() AND auth.can_write());

CREATE POLICY "reviewer_update_supplier_requests" ON supplier_data_requests
  FOR UPDATE USING (company_id = auth.user_company_id() AND auth.can_approve());

-- ============================================================
-- WORKFLOW INSTANCES
-- ============================================================
-- A running approval. Scoped through its definition, which carries the
-- company_id. 0002 covered workflow_definitions and stopped there, so the
-- instances and steps -- the part with the actual approval decisions in it --
-- were readable across tenants.
--
-- No DELETE policy: an approval that ran is a fact about the record it approved.

CREATE POLICY "company_view_workflow_instances" ON workflow_instances
  FOR SELECT USING (auth.company_owns_workflow_definition(definition_id));

CREATE POLICY "writer_create_workflow_instances" ON workflow_instances
  FOR INSERT WITH CHECK (
    auth.company_owns_workflow_definition(definition_id)
    AND auth.can_write()
    -- The creator recorded on the row must be the caller. Without this an
    -- authorised user could open a workflow attributed to a colleague, which is
    -- the kind of misattribution an approval trail exists to prevent.
    AND created_by = auth.current_user_id()
  );

CREATE POLICY "approver_advance_workflow_instances" ON workflow_instances
  FOR UPDATE USING (
    auth.company_owns_workflow_definition(definition_id)
    AND auth.can_approve()
  );

-- ============================================================
-- WORKFLOW STEPS
-- ============================================================
-- One approval decision, optionally carrying a digital signature.
--
-- The tightest table in this migration, and deliberately so:
--
--   * SELECT is company-wide. An approval trail nobody can read is not a trail;
--     auditors in particular must see it, and they have no write capability.
--   * INSERT requires approval capability and the step's assignee to be either
--     the caller or nobody yet.
--   * UPDATE is only allowed on a step that has not completed, and only by its
--     own assignee. Once `completed_at` is set the decision and its signature are
--     frozen -- a signature that can be edited after the fact certifies nothing.
--   * there is no DELETE policy at all. Not an omission: a deletable approval
--     trail is not an approval trail.
--
-- `USING` guards the row as it exists and `WITH CHECK` guards the row as it will
-- exist, so the caller can neither edit a completed step nor complete a step by
-- reassigning it to someone else on the way.

CREATE POLICY "company_view_workflow_steps" ON workflow_steps
  FOR SELECT USING (auth.company_owns_workflow_instance(instance_id));

CREATE POLICY "approver_create_workflow_steps" ON workflow_steps
  FOR INSERT WITH CHECK (
    auth.company_owns_workflow_instance(instance_id)
    AND auth.can_approve()
    AND (assignee_id IS NULL OR assignee_id = auth.current_user_id())
  );

CREATE POLICY "assignee_complete_workflow_steps" ON workflow_steps
  FOR UPDATE
  USING (
    auth.company_owns_workflow_instance(instance_id)
    AND auth.can_approve()
    AND assignee_id = auth.current_user_id()
    AND completed_at IS NULL
  )
  WITH CHECK (
    auth.company_owns_workflow_instance(instance_id)
    AND assignee_id = auth.current_user_id()
  );

-- ============================================================
-- TARGET PROGRESS
-- ============================================================
-- Measured performance against a reduction target, scoped through the target.
-- 0002 covered reduction_targets and not their progress, so every company's
-- year-by-year performance was readable across tenants.

CREATE POLICY "company_view_target_progress" ON target_progress
  FOR SELECT USING (auth.company_owns_reduction_target(target_id));

CREATE POLICY "writer_create_target_progress" ON target_progress
  FOR INSERT WITH CHECK (
    auth.company_owns_reduction_target(target_id)
    AND auth.can_write()
  );

CREATE POLICY "writer_update_target_progress" ON target_progress
  FOR UPDATE USING (
    auth.company_owns_reduction_target(target_id)
    AND auth.can_write()
  );

CREATE POLICY "admin_delete_target_progress" ON target_progress
  FOR DELETE USING (
    auth.company_owns_reduction_target(target_id)
    AND auth.can_administer()
  );

-- ============================================================
-- USER SITE ACCESS
-- ============================================================
-- Per-site grants layered on top of a user's company role.
--
-- This is a permission table, so the rule that matters is the one about writes:
-- a user must never be able to grant themselves access. SELECT lets a user see
-- their own grants and lets administrators see every grant in their company;
-- INSERT, UPDATE and DELETE are administrator-only, and the grant must point at
-- a user and a site that both belong to the administrator's own company --
-- otherwise a company_admin could hand one of their users a foothold in another
-- tenant's site.

CREATE POLICY "user_view_own_site_access" ON user_site_access
  FOR SELECT USING (
    user_id = auth.current_user_id()
    OR (auth.company_owns_user(user_id) AND auth.can_administer())
  );

CREATE POLICY "admin_grant_site_access" ON user_site_access
  FOR INSERT WITH CHECK (
    auth.can_administer()
    AND auth.company_owns_user(user_id)
    AND auth.company_owns_site(site_id)
  );

CREATE POLICY "admin_amend_site_access" ON user_site_access
  FOR UPDATE
  USING (auth.can_administer() AND auth.company_owns_user(user_id))
  WITH CHECK (
    auth.can_administer()
    AND auth.company_owns_user(user_id)
    AND auth.company_owns_site(site_id)
  );

CREATE POLICY "admin_revoke_site_access" ON user_site_access
  FOR DELETE USING (auth.can_administer() AND auth.company_owns_user(user_id));

-- ============================================================
-- REFERENCE DATA: emission_factor_sets, scope3_categories, unit_conversions
-- ============================================================
-- Shared across every tenant and owned by none of them: published emission factor
-- versions, the GHG Protocol's fifteen Scope 3 categories, and unit conversion
-- constants. Readable by all, writable by the platform operator only.
--
-- Note a deliberate divergence from 0002. Its `admin_manage_emission_factors`
-- policy grants write on the global factor library to `company_admin` as well as
-- `super_admin`, which lets one tenant's administrator alter factors every other
-- tenant calculates with. The three tables below are therefore super_admin-only.
-- 0002 is left exactly as it is: it is already verified, a permissive policy
-- cannot be narrowed by adding another one, and closing it needs a RESTRICTIVE
-- policy plus a decision about existing behaviour that belongs in its own change.
--
-- `USING (true)` for reads matches 0002's `all_view_emission_factors` and avoids
-- naming the `anon`/`authenticated` roles, which do not exist outside Supabase and
-- would make these migrations fail on a plain Postgres.

CREATE POLICY "all_view_emission_factor_sets" ON emission_factor_sets
  FOR SELECT USING (true);

CREATE POLICY "platform_manage_emission_factor_sets" ON emission_factor_sets
  FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "all_view_scope3_categories" ON scope3_categories
  FOR SELECT USING (true);

CREATE POLICY "platform_manage_scope3_categories" ON scope3_categories
  FOR ALL USING (auth.user_role() = 'super_admin');

CREATE POLICY "all_view_unit_conversions" ON unit_conversions
  FOR SELECT USING (true);

CREATE POLICY "platform_manage_unit_conversions" ON unit_conversions
  FOR ALL USING (auth.user_role() = 'super_admin');

-- ============================================================
-- INDEXES SUPPORTING THE POLICIES ABOVE
-- ============================================================
-- Every policy that reaches its company_id through a foreign key runs an EXISTS
-- on the parent for each candidate row. Without an index on the child's foreign
-- key that turns a filtered read into a sequential scan of the child table, so
-- the indexes are part of the policy, not an optimisation to do later.

CREATE INDEX IF NOT EXISTS "idx_production_lines_facility_id"
  ON production_lines ("facility_id");
CREATE INDEX IF NOT EXISTS "idx_equipment_line_id"
  ON equipment ("line_id");
CREATE INDEX IF NOT EXISTS "idx_emission_sources_company_id"
  ON emission_sources ("company_id");
CREATE INDEX IF NOT EXISTS "idx_emission_record_attachments_record_id"
  ON emission_record_attachments ("record_id");
CREATE INDEX IF NOT EXISTS "idx_scope3_records_company_id"
  ON scope3_records ("company_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_emissions_company_id"
  ON supplier_emissions ("company_id");
CREATE INDEX IF NOT EXISTS "idx_supplier_data_requests_company_id"
  ON supplier_data_requests ("company_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_instances_definition_id"
  ON workflow_instances ("definition_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_steps_instance_id"
  ON workflow_steps ("instance_id");
CREATE INDEX IF NOT EXISTS "idx_target_progress_target_id"
  ON target_progress ("target_id");
CREATE INDEX IF NOT EXISTS "idx_user_site_access_user_id"
  ON user_site_access ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_site_access_site_id"
  ON user_site_access ("site_id");
