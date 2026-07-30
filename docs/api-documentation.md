# API Documentation

## Base URL

```
https://your-domain.com/api/v1
```

## Authentication

All API endpoints require authentication via Bearer token:

```
Authorization: Bearer <supabase-access-token>
```

## Endpoints

### Emissions

#### GET /api/v1/emissions

List emission records with filters and pagination.

**Query Parameters:**
- `scope` - Filter by scope (scope1, scope2, scope3)
- `status` - Filter by status (draft, pending, approved, rejected)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response:**
```json
{
  "items": [...],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

#### POST /api/v1/emissions

Create a new emission record.

**Request Body:**
```json
{
  "scope": "scope1",
  "emission_source_type": "stationary_combustion",
  "activity_data": 1000,
  "unit": "Nm3",
  "fuel_type": "natural_gas",
  "site_id": "uuid",
  "period_start": "2024-01-01",
  "period_end": "2024-01-31"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "scope": "scope1",
  "status": "draft",
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Calculate

#### POST /api/v1/calculate

Calculate GHG emissions from activity data.

**Request Body:**
```json
{
  "activity_data": 1000,
  "unit": "Nm3",
  "emission_source_type": "stationary_combustion",
  "scope": "scope1",
  "fuel_type": "natural_gas"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "co2e_kg": 2177.395,
    "co2_kg": 2176,
    "ch4_kg": 0.05,
    "n2o_kg": 0.001,
    "formula_used": "CO2e = (Activity x CO2_EF) + ...",
    "calculation_steps": [...],
    "emission_factor_used": {
      "provider": "Korea MOE + IPCC 2006",
      "version": "2023",
      "value": 2.176,
      "unit": "kgCO2/Nm3"
    },
    "uncertainty_pct": 11.18,
    "data_quality_score": 1.6
  }
}
```

### Emission Factors

#### GET /api/v1/emission-factors

Browse emission factor library.

**Query Parameters:**
- `provider` - Filter by provider (korea_moe, ipcc_2006, defra_2023)
- `search` - Search by name or description

### Reports

#### GET /api/v1/reports

List generated reports.

#### POST /api/v1/reports

Generate a new report.

**Request Body:**
```json
{
  "type": "ISO14064",
  "period_start": "2023-01-01",
  "period_end": "2023-12-31",
  "scopes": ["scope1", "scope2", "scope3"],
  "format": "pdf"
}
```

### Audit Log

#### GET /api/v1/audit-log

Read-only endpoint for audit log entries.

**Query Parameters:**
- `table` - Filter by table name
- `action` - Filter by action type
- `page`, `limit` - Pagination

### Organizations

#### GET /api/v1/organizations

List organizations accessible to the authenticated user.

#### POST /api/v1/organizations

Create a new organization.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error description",
  "details": [...] // Optional validation details
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limits

- Default: 100 requests per minute per user
- Calculation endpoint: 50 requests per minute
- Report generation: 10 requests per hour

## Pagination

All list endpoints support cursor-based pagination:
- `page` - Page number (1-indexed)
- `limit` - Items per page (max 100)
- Response includes `total` count

## Filtering

Date filters accept ISO 8601 format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`
