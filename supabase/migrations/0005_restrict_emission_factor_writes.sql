-- Close `admin_manage_emission_factors`: writes to the global emission factor
-- library are the platform operator's, not a tenant administrator's.
--
-- 0002 wrote:
--
--   CREATE POLICY "admin_manage_emission_factors" ON emission_factors
--     FOR ALL USING (auth.user_role() IN ('super_admin', 'company_admin'));
--
-- `emission_factors` has no `company_id`. It is one shared table of published
-- factors -- Korea MOE, IPCC, DEFRA, EPA, IEA, ecoinvent -- and every tenant's
-- CO2e figures are computed against the rows in it. So that policy lets any one
-- tenant's `company_admin` edit or delete the coefficients every other tenant
-- calculates with, and the resulting numbers go into CDP and SBTi submissions
-- and ISO 14064 reports. A tenant boundary that holds for records and not for
-- the factors those records multiply by is not a tenant boundary.
--
-- 0003 already settled the intended rule for the sibling reference tables --
-- `emission_factor_sets`, `scope3_categories`, `unit_conversions` are
-- super_admin-only on write -- and explicitly deferred this one, because
-- permissive policies are OR-ed together: adding a narrower permissive policy
-- cannot take away what an existing one grants. Only a RESTRICTIVE policy, which
-- is AND-ed with the permissive result, can. 0002 is therefore left untouched.
--
-- Per command rather than `FOR ALL`, deliberately: a RESTRICTIVE `FOR ALL` would
-- also be AND-ed into SELECT and would silently undo
-- `all_view_emission_factors`, making the factor library unreadable to everyone
-- but super_admin. Read stays open; only the three write paths narrow.
--
-- Behaviour this removes: a `company_admin` can no longer insert, update or
-- delete emission factors. Nothing in the application depended on it --
-- src/app/api/v1/emission-factors/route.ts exposes GET only, and no code path
-- writes to the table -- so this closes a hole rather than withdrawing a feature
-- in use. There is no per-tenant factor table to relocate custom factors to; if
-- tenant-specific factors are wanted later they need a `company_id` and their own
-- company-scoped policies, which is a schema change, not a policy change.
--
-- `service_role` has BYPASSRLS in Supabase, so the platform's own ingestion of
-- new factor sets is unaffected by this and by the policies in 0002/0003.
--
-- Touches none of 0001-0004.

-- Re-runnable: CREATE POLICY has no IF NOT EXISTS, and these three names are
-- introduced here, so dropping first is safe and makes re-application a no-op
-- rather than a duplicate_object error.
DROP POLICY IF EXISTS "platform_only_insert_emission_factors" ON emission_factors;
DROP POLICY IF EXISTS "platform_only_update_emission_factors" ON emission_factors;
DROP POLICY IF EXISTS "platform_only_delete_emission_factors" ON emission_factors;

-- INSERT takes WITH CHECK only; there is no existing row to test.
CREATE POLICY "platform_only_insert_emission_factors" ON emission_factors
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (auth.user_role() = 'super_admin');

-- Both clauses on UPDATE: USING decides which rows may be targeted, WITH CHECK
-- decides what they may become. Omitting WITH CHECK would leave the post-image
-- unchecked.
CREATE POLICY "platform_only_update_emission_factors" ON emission_factors
  AS RESTRICTIVE FOR UPDATE
  USING (auth.user_role() = 'super_admin')
  WITH CHECK (auth.user_role() = 'super_admin');

CREATE POLICY "platform_only_delete_emission_factors" ON emission_factors
  AS RESTRICTIVE FOR DELETE
  USING (auth.user_role() = 'super_admin');
