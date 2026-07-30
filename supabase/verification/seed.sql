-- Two tenants, with a row in every table 0003 governs.
INSERT INTO companies (id, name, industry, country) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Company A', 'manufacturing', 'KR'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Company B', 'energy', 'JP');

INSERT INTO users (id, email, name, role, company_id) VALUES
  ('a0000000-0000-4000-8000-00000000000a', 'admin@a.example',    'A Admin',    'company_admin', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-00000000000b', 'viewer@a.example',   'A Viewer',   'viewer',        'aaaaaaaa-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-00000000000c', 'reviewer@a.example', 'A Reviewer', 'reviewer',      'aaaaaaaa-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-00000000000a', 'admin@b.example',    'B Admin',    'company_admin', 'bbbbbbbb-0000-4000-8000-000000000001');

INSERT INTO sites (id, company_id, name) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'A Site'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'B Site');

INSERT INTO facilities (id, site_id, name, type) VALUES
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'A Facility', 'boiler_house'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'B Facility', 'boiler_house');

INSERT INTO production_lines (id, facility_id, name) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'A Line'),
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'B Line');

INSERT INTO equipment (id, line_id, name, type) VALUES
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 'A Boiler', 'boiler'),
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'B Boiler', 'boiler');

INSERT INTO emission_sources (id, company_id, scope, category) VALUES
  ('a5000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '1', 'stationary_combustion'),
  ('b5000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '1', 'stationary_combustion');

INSERT INTO emission_records
  (id, company_id, site_id, period_start, period_end, scope, category, activity_data_value, activity_data_unit, co2e_kg)
VALUES
  ('a6000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   '2024-01-01', '2024-01-31', '1', 'stationary_combustion', 100, 'Nm3', 1000),
  ('b6000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   '2024-01-01', '2024-01-31', '1', 'stationary_combustion', 200, 'Nm3', 2000);

INSERT INTO emission_record_attachments (id, record_id, file_name, file_url) VALUES
  ('a7000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'a-invoice.pdf', 'https://example.com/a'),
  ('b7000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'b-invoice.pdf', 'https://example.com/b');

INSERT INTO scope3_categories (id, category_number, name) VALUES
  ('c0000000-0000-4000-8000-000000000001', 1, 'Purchased goods and services');

INSERT INTO scope3_records (id, company_id, category_number, period_start, period_end, co2e_kg) VALUES
  ('a8000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 1, '2024-01-01', '2024-12-31', 8420500),
  ('b8000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 1, '2024-01-01', '2024-12-31', 9999999);

INSERT INTO suppliers (id, company_id, name) VALUES
  ('a9000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'A Supplier'),
  ('b9000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'B Supplier');

INSERT INTO supplier_emissions (id, supplier_id, company_id, category_number, period_start, period_end, co2e_kg) VALUES
  ('aa000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 1, '2024-01-01', '2024-12-31', 8420500),
  ('ba000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 1, '2024-01-01', '2024-12-31', 7777777);

INSERT INTO supplier_data_requests (id, supplier_id, company_id, period, status) VALUES
  ('ab000000-0000-4000-8000-000000000001', 'a9000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2024', 'submitted'),
  ('bb000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '2024', 'submitted');

INSERT INTO reduction_targets
  (id, company_id, target_type, base_year, target_year, base_emissions, target_emissions, target_reduction_pct)
VALUES
  ('ac000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'absolute', 2018, 2030, 19000, 9500, 50),
  ('bc000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'absolute', 2018, 2030, 50000, 25000, 50);

INSERT INTO target_progress (id, target_id, year, actual_emissions) VALUES
  ('ad000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001', 2024, 12760),
  ('bd000000-0000-4000-8000-000000000001', 'bc000000-0000-4000-8000-000000000001', 2024, 41000);

INSERT INTO workflow_definitions (id, name, steps, company_id) VALUES
  ('ae000000-0000-4000-8000-000000000001', 'A Approval', '[]'::jsonb, 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('be000000-0000-4000-8000-000000000001', 'B Approval', '[]'::jsonb, 'bbbbbbbb-0000-4000-8000-000000000001');

INSERT INTO workflow_instances (id, definition_id, record_type, record_id, created_by) VALUES
  ('af000000-0000-4000-8000-000000000001', 'ae000000-0000-4000-8000-000000000001', 'emission_record',
   'a6000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a'),
  ('bf000000-0000-4000-8000-000000000001', 'be000000-0000-4000-8000-000000000001', 'emission_record',
   'b6000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-00000000000a');

-- Step 1 of A's workflow is open and assigned to A's reviewer; step 2 is
-- completed and signed, which is the row that must be frozen.
INSERT INTO workflow_steps (id, instance_id, step_number, assignee_id, action, digital_signature, completed_at) VALUES
  ('c1000000-1111-4000-8000-000000000001', 'af000000-0000-4000-8000-000000000001', 1,
   'a0000000-0000-4000-8000-00000000000c', NULL, NULL, NULL),
  ('c1000000-1111-4000-8000-000000000002', 'af000000-0000-4000-8000-000000000001', 2,
   'a0000000-0000-4000-8000-00000000000c', 'approve', 'signed-hash', now()),
  ('c1000000-1111-4000-8000-000000000003', 'bf000000-0000-4000-8000-000000000001', 1,
   'b0000000-0000-4000-8000-00000000000a', NULL, NULL, NULL);

INSERT INTO user_site_access (id, user_id, site_id, can_write) VALUES
  ('c2000000-1111-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000b', 'a1000000-0000-4000-8000-000000000001', false),
  ('c2000000-1111-4000-8000-000000000002', 'b0000000-0000-4000-8000-00000000000a', 'b1000000-0000-4000-8000-000000000001', true);

INSERT INTO emission_factor_sets (id, name, provider, version, valid_from) VALUES
  ('c3000000-1111-4000-8000-000000000001', 'Korea MOE 2023', 'korea_moe', '2023', '2023-01-01');

INSERT INTO unit_conversions (id, from_unit, to_unit, conversion_factor, category) VALUES
  ('c4000000-1111-4000-8000-000000000001', 'kg', 't', 0.001, 'mass');
