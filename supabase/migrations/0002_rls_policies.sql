-- Row Level Security (RLS) Policies for CarbonLedger AI
-- Ensures multi-tenant data isolation and role-based access

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE emission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's company_id
CREATE OR REPLACE FUNCTION auth.user_company_id()
RETURNS uuid AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'company_id')::uuid;
$$ LANGUAGE sql STABLE;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS text AS $$
  SELECT auth.jwt() -> 'user_metadata' ->> 'role';
$$ LANGUAGE sql STABLE;

-- ============================================================
-- COMPANIES: Users can only see their own company
-- ============================================================
CREATE POLICY "users_view_own_company" ON companies
  FOR SELECT USING (id = auth.user_company_id());

CREATE POLICY "admin_update_own_company" ON companies
  FOR UPDATE USING (
    id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin')
  );

-- ============================================================
-- SITES: Company-scoped access
-- ============================================================
CREATE POLICY "company_view_sites" ON sites
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "admin_manage_sites" ON sites
  FOR ALL USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin', 'site_admin')
  );

-- ============================================================
-- FACILITIES: Company-scoped through sites
-- ============================================================
CREATE POLICY "company_view_facilities" ON facilities
  FOR SELECT USING (
    site_id IN (SELECT id FROM sites WHERE company_id = auth.user_company_id())
  );

CREATE POLICY "admin_manage_facilities" ON facilities
  FOR ALL USING (
    site_id IN (SELECT id FROM sites WHERE company_id = auth.user_company_id())
    AND auth.user_role() IN ('super_admin', 'company_admin', 'site_admin')
  );

-- ============================================================
-- EMISSION RECORDS: Company-scoped, role-based write access
-- ============================================================
CREATE POLICY "company_view_emissions" ON emission_records
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "writer_create_emissions" ON emission_records
  FOR INSERT WITH CHECK (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "writer_update_emissions" ON emission_records
  FOR UPDATE USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin', 'site_admin', 'reviewer')
  );

CREATE POLICY "admin_delete_emissions" ON emission_records
  FOR DELETE USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin')
  );

-- ============================================================
-- EMISSION FACTORS: Read for all authenticated, write for admin
-- ============================================================
CREATE POLICY "all_view_emission_factors" ON emission_factors
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_emission_factors" ON emission_factors
  FOR ALL USING (
    auth.user_role() IN ('super_admin', 'company_admin')
  );

-- ============================================================
-- AUDIT LOGS: Read-only for all, no delete/update
-- ============================================================
CREATE POLICY "company_view_audit_logs" ON audit_logs
  FOR SELECT USING (company_id = auth.user_company_id());

-- No INSERT policy for end users (system only via service role)
-- No UPDATE or DELETE policies (immutable)

-- ============================================================
-- REPORTS: Company-scoped
-- ============================================================
CREATE POLICY "company_view_reports" ON reports
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "admin_create_reports" ON reports
  FOR INSERT WITH CHECK (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin', 'site_admin')
  );

CREATE POLICY "admin_manage_reports" ON reports
  FOR UPDATE USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin')
  );

-- ============================================================
-- SUPPLIERS: Company-scoped
-- ============================================================
CREATE POLICY "company_view_suppliers" ON suppliers
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "admin_manage_suppliers" ON suppliers
  FOR ALL USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin', 'site_admin')
  );

-- ============================================================
-- TARGETS: Company-scoped
-- ============================================================
CREATE POLICY "company_view_targets" ON targets
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "admin_manage_targets" ON targets
  FOR ALL USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin')
  );

-- ============================================================
-- USERS: Users can see their own company's users
-- ============================================================
CREATE POLICY "company_view_users" ON users
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "admin_manage_users" ON users
  FOR ALL USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin')
  );

-- ============================================================
-- WORKFLOWS: Company-scoped
-- ============================================================
CREATE POLICY "company_view_workflows" ON workflows
  FOR SELECT USING (company_id = auth.user_company_id());

CREATE POLICY "authorized_manage_workflows" ON workflows
  FOR ALL USING (
    company_id = auth.user_company_id()
    AND auth.user_role() IN ('super_admin', 'company_admin', 'site_admin', 'reviewer')
  );
