# Database Schema Documentation

## Entity Relationship Overview

```
companies (1) ----< sites (1) ----< facilities (1) ----< production_lines (1) ----< equipment
    |                  |
    |                  +----< emission_sources
    |
    +----< users
    +----< emission_records
    +----< emission_factors
    +----< reports
    +----< suppliers
    +----< targets
    +----< workflows
    +----< audit_logs
```

## Table Descriptions

### companies
Main tenant table. Each company operates independently with RLS isolation.
- Primary key: `id` (UUID)
- Key fields: `name`, `industry`, `country`, `fiscal_year_start`
- Soft delete via `deleted_at`

### sites
Physical locations belonging to a company (factories, offices, warehouses).
- Foreign key: `company_id` references `companies.id`
- Includes geolocation (`latitude`, `longitude`)
- `grid_region` for Scope 2 EF lookup

### facilities
Specific areas within a site (boiler room, electrical room, etc.).
- Foreign key: `site_id` references `sites.id`
- `type` categorizes the facility

### emission_records
Core data table storing all emission calculations.
- Foreign keys: `company_id`, `site_id`, `emission_source_id`
- Stores both activity data and calculated results
- `status` workflow: draft > pending > approved/rejected
- Partitioning candidate for large datasets (by period)

### emission_factors
Versioned emission factor library from multiple providers.
- Multi-provider: Korea MOE, IPCC, DEFRA, Custom
- `valid_from`/`valid_to` for temporal versioning
- Company-scoped custom factors supported

### audit_logs
Immutable audit trail. Append-only (no UPDATE/DELETE).
- Records all data changes with before/after snapshots
- Includes user, timestamp, IP address
- RLS: read-only per company

### users
Platform users with role-based access.
- `role` enum: super_admin, company_admin, site_admin, reviewer, auditor, viewer, consultant
- `company_id` for tenant scoping

## Indexing Strategy

- All foreign keys indexed by default (Drizzle)
- `emission_records`: Composite index on (company_id, period_start, scope)
- `audit_logs`: Index on (company_id, timestamp DESC)
- `emission_factors`: Index on (provider, version, fuel_type)

## Partitioning Approach

For large `emission_records` tables (millions of rows):
- Range partition by `period_start` (monthly or yearly)
- Keeps queries fast for recent data
- Old partitions can be archived to cold storage

## Data Retention

- Active records: Always available
- Audit logs: 7+ years (regulatory requirement)
- Deleted records: Soft-deleted (retained for audit)
- Reports: Retained indefinitely
