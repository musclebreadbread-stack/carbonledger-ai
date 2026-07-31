-- Seed Data for CarbonLedger AI
-- Sample Korean manufacturing company with comprehensive test data.
--
-- Applies on top of 0001 -> 0005 against a plain Postgres 16 (the environment
-- supabase/verification/run.sh builds) and on the compose `db` service, which
-- mounts this file after docker/initdb/10-apply-migrations.sh.
--
-- Every column name, table name and enum label below is the one 0001 declares.
-- The previous revision of this file was written against a schema that never
-- existed -- six of its nine statements were rejected -- so if it is edited
-- again, apply it before committing. initdb aborts the whole container on the
-- first error, so a broken seed is not a partial seed, it is no database.
--
-- Notes on the mapping to 0001, where the natural shape differs from the data:
--   * `emission_sources` has no site/facility/name columns. A source is located
--     by `equipment_id` -> equipment -> production_lines -> facilities -> sites,
--     so the physical assets are seeded and the human-readable asset name lives
--     on `equipment`. `emission_records.site_id` is set to the site that chain
--     resolves to.
--   * Provider, version and validity are properties of `emission_factor_sets`,
--     not of an individual factor, and `provider` is the `ef_provider` enum
--     ('korea_moe', 'ipcc', ...) rather than free text.
--   * `emission_scope` labels are '1' / '2' / '3'.
--   * There is no `targets` table (it is `reduction_targets`, which requires
--     `target_reduction_pct` and has no name/unit column) and no `workflows`
--     table (it is `workflow_definitions` + `workflow_instances` +
--     `workflow_steps`).
--
-- Insert order is FK order; do not reorder without checking 0001's constraints.

-- ============================================================
-- Company
-- ============================================================
INSERT INTO companies (id, name, industry, country, registration_number, fiscal_year_start)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '한국제조 주식회사',
  'manufacturing',
  'South Korea',
  '123-45-67890',
  1
);

-- ============================================================
-- Sites
-- ============================================================
INSERT INTO sites (id, company_id, name, address, latitude, longitude, grid_region)
VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', '울산 본사 공장', '울산광역시 남구 산업로 123', 35.5384, 129.3114, 'Korea'),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', '인천 제2공장', '인천광역시 서구 경서동 456', 37.4563, 126.7052, 'Korea');

-- ============================================================
-- Facilities
-- ============================================================
INSERT INTO facilities (id, site_id, name, type)
VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', '보일러동', 'boiler_house'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', '차량관리동', 'vehicle_depot'),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222202', '전기실', 'electrical'),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222202', '냉동설비동', 'refrigeration');

-- ============================================================
-- Production lines
-- One per facility: `equipment` hangs off a line, not off a facility directly.
-- ============================================================
INSERT INTO production_lines (id, facility_id, name)
VALUES
  ('3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a01', '33333333-3333-3333-3333-333333333301', '증기 공급 계통'),
  ('3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a02', '33333333-3333-3333-3333-333333333302', '물류 운송 계통'),
  ('3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a03', '33333333-3333-3333-3333-333333333303', '수배전 계통'),
  ('3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a04', '33333333-3333-3333-3333-333333333304', '공정 냉각 계통');

-- ============================================================
-- Equipment
-- The named physical asset behind each emission source.
-- ============================================================
INSERT INTO equipment (id, line_id, name, type, capacity, refrigerant_type, refrigerant_charge_kg)
VALUES
  ('3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b01', '3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a01', '산업용 보일러 #1', 'boiler', 12.5000, NULL, NULL),
  ('3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b02', '3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a02', '법인 화물차량 (경유)', 'vehicle', NULL, NULL, NULL),
  ('3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b03', '3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a03', '수전 설비 (한전 인입)', 'switchgear', 3000.0000, NULL, NULL),
  ('3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b04', '3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a04', '냉동기 #1', 'chiller', 800.0000, 'R410A', 120.000);

-- ============================================================
-- Users (various roles)
-- `users.id` has no default: on a real Supabase project it is the auth.users id.
-- ============================================================
INSERT INTO users (id, company_id, email, name, role, active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '11111111-1111-1111-1111-111111111111', 'admin@hankook-mfg.co.kr', '김관리', 'company_admin', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', '11111111-1111-1111-1111-111111111111', 'site-admin@hankook-mfg.co.kr', '이현장', 'site_admin', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', '11111111-1111-1111-1111-111111111111', 'reviewer@hankook-mfg.co.kr', '박검토', 'reviewer', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa004', '11111111-1111-1111-1111-111111111111', 'auditor@hankook-mfg.co.kr', '정감사', 'auditor', true),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa005', '11111111-1111-1111-1111-111111111111', 'viewer@hankook-mfg.co.kr', '최열람', 'viewer', true);

-- ============================================================
-- Emission Sources
-- ============================================================
INSERT INTO emission_sources (id, equipment_id, company_id, scope, category, fuel_type, source_description, measurement_method)
VALUES
  ('44444444-4444-4444-4444-444444444401', '3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b01', '11111111-1111-1111-1111-111111111111', '1', 'stationary_combustion', 'natural_gas', '울산 보일러동 LNG 연소 보일러 (증기 생산)', 'calculation'),
  ('44444444-4444-4444-4444-444444444402', '3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b02', '11111111-1111-1111-1111-111111111111', '1', 'mobile_combustion', 'diesel', '울산 차량관리동 법인 차량 경유 사용', 'calculation'),
  ('44444444-4444-4444-4444-444444444403', '3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b03', '11111111-1111-1111-1111-111111111111', '2', 'purchased_electricity', 'grid_electricity', '인천 전기실 한국전력공사 전력 구매', 'calculation'),
  ('44444444-4444-4444-4444-444444444404', '3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b04', '11111111-1111-1111-1111-111111111111', '1', 'fugitive_emissions', 'R410A', '인천 냉동설비동 HVAC 시스템 R410A 냉매 누출', 'direct_measurement');

-- ============================================================
-- Emission Factor Sets
-- valid_to is left NULL: these sets are still in force, and the records below
-- are 2024. A set that expired in 2023 could not have produced them.
-- ============================================================
INSERT INTO emission_factor_sets (id, name, provider, version, valid_from, valid_to, is_active)
VALUES
  ('6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a01', 'Korea MOE 2023 국가 고유 배출계수', 'korea_moe', '2023', '2023-01-01', NULL, true),
  ('6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a02', 'IPCC AR6 GWP', 'ipcc', 'AR6', '2021-01-01', NULL, true);

-- ============================================================
-- Emission Factors (Korea MOE 2023 reference data)
-- ============================================================
INSERT INTO emission_factors (id, set_id, category, fuel_type, unit_numerator, unit_denominator, co2_factor, ch4_factor, n2o_factor, gwp_ar, year, source_reference)
VALUES
  ('66666666-6666-6666-6666-666666666601', '6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a01', 'stationary_combustion',  'natural_gas',       'kgCO2e', 'Nm3', 2.17600000, 0.00005000,  0.00000100, 'AR5', 2023, '환경부 2023 국가 온실가스 배출계수 (Korea)'),
  ('66666666-6666-6666-6666-666666666602', '6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a01', 'mobile_combustion',      'diesel',            'kgCO2e', 'L',   2.58400000, 0.00015000,  0.00000400, 'AR5', 2023, '환경부 2023 국가 온실가스 배출계수 (Korea)'),
  ('66666666-6666-6666-6666-666666666603', '6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a01', 'purchased_electricity',  'grid_electricity',  'kgCO2e', 'kWh', 0.45940000, 0.00000540,  0.00000720, 'AR5', 2023, '환경부 2023 국가 전력 배출계수 (Korea grid)'),
  ('66666666-6666-6666-6666-666666666604', '6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a01', 'mobile_combustion',      'gasoline',          'kgCO2e', 'L',   2.20800000, 0.00010000,  0.00000200, 'AR5', 2023, '환경부 2023 국가 온실가스 배출계수 (Korea)'),
  ('66666666-6666-6666-6666-666666666605', '6a6a6a6a-6a6a-6a6a-6a6a-6a6a6a6a6a02', 'fugitive_emissions',     'R410A',             'kgCO2e', 'kg',  2256.00000000, NULL,     NULL,       'AR6', 2021, 'IPCC AR6 100-year GWP for R-410A blend (global)');

-- ============================================================
-- Emission Records (Jan-Jun 2024, multiple scopes)
-- co2e_kg = co2_kg + 28 x ch4_kg + 265 x n2o_kg (AR5 100-year GWP), and each
-- gas figure is the activity value times the factor on the linked row, so the
-- numbers reconcile rather than merely looking plausible.
-- ============================================================
INSERT INTO emission_records (id, source_id, company_id, site_id, period_start, period_end, scope, category, activity_data_value, activity_data_unit, emission_factor_id, emission_factor_value, co2e_kg, co2_kg, ch4_kg, n2o_kg, calculation_formula, status, submitted_by, reviewed_by, approved_by)
VALUES
  -- Scope 1: Boiler LNG (monthly)
  ('55555555-5555-5555-5555-555555550101', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-01-01', '2024-01-31', '1', 'stationary_combustion', 50000, 'Nm3', '66666666-6666-6666-6666-666666666601', 2.17600000, 108883.250000, 108800.000000, 2.500000, 0.050000, 'CO2e = 50000 Nm3 x (2.176 + 0.00005 x 28 + 0.000001 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550102', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-02-01', '2024-02-29', '1', 'stationary_combustion', 48000, 'Nm3', '66666666-6666-6666-6666-666666666601', 2.17600000, 104527.920000, 104448.000000, 2.400000, 0.048000, 'CO2e = 48000 Nm3 x (2.176 + 0.00005 x 28 + 0.000001 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550103', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-03-01', '2024-03-31', '1', 'stationary_combustion', 42000, 'Nm3', '66666666-6666-6666-6666-666666666601', 2.17600000, 91461.930000, 91392.000000, 2.100000, 0.042000, 'CO2e = 42000 Nm3 x (2.176 + 0.00005 x 28 + 0.000001 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550104', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-04-01', '2024-04-30', '1', 'stationary_combustion', 35000, 'Nm3', '66666666-6666-6666-6666-666666666601', 2.17600000, 76218.275000, 76160.000000, 1.750000, 0.035000, 'CO2e = 35000 Nm3 x (2.176 + 0.00005 x 28 + 0.000001 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550105', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-05-01', '2024-05-31', '1', 'stationary_combustion', 28000, 'Nm3', '66666666-6666-6666-6666-666666666601', 2.17600000, 60974.620000, 60928.000000, 1.400000, 0.028000, 'CO2e = 28000 Nm3 x (2.176 + 0.00005 x 28 + 0.000001 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550106', '44444444-4444-4444-4444-444444444401', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-06-01', '2024-06-30', '1', 'stationary_combustion', 25000, 'Nm3', '66666666-6666-6666-6666-666666666601', 2.17600000, 54441.625000, 54400.000000, 1.250000, 0.025000, 'CO2e = 25000 Nm3 x (2.176 + 0.00005 x 28 + 0.000001 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  -- Scope 1: Vehicle diesel (quarterly)
  ('55555555-5555-5555-5555-555555550201', '44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-01-01', '2024-03-31', '1', 'mobile_combustion', 5000, 'L', '66666666-6666-6666-6666-666666666602', 2.58400000, 12946.300000, 12920.000000, 0.750000, 0.020000, 'CO2e = 5000 L x (2.584 + 0.00015 x 28 + 0.000004 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550202', '44444444-4444-4444-4444-444444444402', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222201', '2024-04-01', '2024-06-30', '1', 'mobile_combustion', 4800, 'L', '66666666-6666-6666-6666-666666666602', 2.58400000, 12428.448000, 12403.200000, 0.720000, 0.019200, 'CO2e = 4800 L x (2.584 + 0.00015 x 28 + 0.000004 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  -- Scope 2: Electricity (monthly)
  ('55555555-5555-5555-5555-555555550301', '44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', '2024-01-01', '2024-01-31', '2', 'purchased_electricity', 800000, 'kWh', '66666666-6666-6666-6666-666666666603', 0.45940000, 369167.360000, 367520.000000, 4.320000, 5.760000, 'CO2e = 800000 kWh x (0.4594 + 0.0000054 x 28 + 0.0000072 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550302', '44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', '2024-02-01', '2024-02-29', '2', 'purchased_electricity', 750000, 'kWh', '66666666-6666-6666-6666-666666666603', 0.45940000, 346094.400000, 344550.000000, 4.050000, 5.400000, 'CO2e = 750000 kWh x (0.4594 + 0.0000054 x 28 + 0.0000072 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550303', '44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', '2024-03-01', '2024-03-31', '2', 'purchased_electricity', 820000, 'kWh', '66666666-6666-6666-6666-666666666603', 0.45940000, 378396.544000, 376708.000000, 4.428000, 5.904000, 'CO2e = 820000 kWh x (0.4594 + 0.0000054 x 28 + 0.0000072 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  ('55555555-5555-5555-5555-555555550304', '44444444-4444-4444-4444-444444444403', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', '2024-04-01', '2024-04-30', '2', 'purchased_electricity', 850000, 'kWh', '66666666-6666-6666-6666-666666666603', 0.45940000, 392240.320000, 390490.000000, 4.590000, 6.120000, 'CO2e = 850000 kWh x (0.4594 + 0.0000054 x 28 + 0.0000072 x 265)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'),
  -- Scope 1: Fugitive refrigerant loss (half-year). The gas columns stay NULL
  -- rather than 0: no CO2, CH4 or N2O is released, the 3.5 kg is R410A and the
  -- factor is its GWP.
  ('55555555-5555-5555-5555-555555550401', '44444444-4444-4444-4444-444444444404', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222202', '2024-01-01', '2024-06-30', '1', 'fugitive_emissions', 3.5, 'kg', '66666666-6666-6666-6666-666666666605', 2256.00000000, 7896.000000, NULL, NULL, NULL, 'CO2e = 3.5 kg x 2256 (R-410A GWP100, AR6)', 'approved', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001');

-- ============================================================
-- Reduction Targets
-- `scope` NULL on the first target means all scopes: `emission_scope` has no
-- 'all' label.
-- ============================================================
INSERT INTO reduction_targets (id, company_id, target_type, base_year, target_year, base_emissions, target_emissions, target_reduction_pct, scope, status, methodology, description)
VALUES
  ('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', 'absolute',  2020, 2030, 15000000.000000, 7500000.000000, 50.00, NULL, 'active', 'SBTi 1.5C absolute contraction', '2030 감축 목표 (전사 절대량 50% 감축, kgCO2e)'),
  ('77777777-7777-7777-7777-777777777702', '11111111-1111-1111-1111-111111111111', 'intensity', 2022, 2030, 0.459400,        0.100000,       78.23, '2',  'active', 'Grid intensity reduction via PPA/REC', 'Scope 2 재생에너지 전환 (kgCO2e/kWh 집약도)');

-- ============================================================
-- Workflow (sample approval of the January boiler record)
-- ============================================================
INSERT INTO workflow_definitions (id, name, description, steps, company_id)
VALUES (
  '88888888-8888-8888-8888-888888888800',
  '배출량 기록 승인',
  '현장 담당자 제출 -> 검토자 검토 -> 관리자 승인',
  '[{"step": 1, "role": "reviewer", "action": "review"}, {"step": 2, "role": "company_admin", "action": "approve"}]'::jsonb,
  '11111111-1111-1111-1111-111111111111'
);

INSERT INTO workflow_instances (id, definition_id, record_type, record_id, current_step, status, created_by)
VALUES (
  '88888888-8888-8888-8888-888888888801',
  '88888888-8888-8888-8888-888888888800',
  'emission_record',
  '55555555-5555-5555-5555-555555550101',
  2,
  'approved',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002'
);

-- Both steps complete and signed, matching the record's `approved` status and
-- its reviewed_by / approved_by.
INSERT INTO workflow_steps (id, instance_id, step_number, assignee_id, action, comment, digital_signature, completed_at)
VALUES
  ('88888888-8888-8888-8888-888888888901', '88888888-8888-8888-8888-888888888801', 1, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', 'review',  '계량기 검침값 및 도시가스 청구서 대조 완료', 'sha256:9f1c2d0e-review-2024-01',  '2024-02-05 10:20:00+09'),
  ('88888888-8888-8888-8888-888888888902', '88888888-8888-8888-8888-888888888801', 2, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'approve', '2024년 1월 Scope 1 고정연소 승인',            'sha256:4b7a8c1f-approve-2024-01', '2024-02-06 14:05:00+09');
