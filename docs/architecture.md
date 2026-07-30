# System Architecture

## Component Diagram

```
+-----------------------------------------------------------+
|                    Client (Browser)                         |
|  +------------------+  +------------------+               |
|  | React 19 (RSC)   |  | Client Components|               |
|  | Server Components |  | (Interactivity)  |               |
|  +------------------+  +------------------+               |
+-----------------------------------------------------------+
                          |
+-----------------------------------------------------------+
|                   Next.js 15 App Router                     |
|  +----------+  +----------+  +----------+  +-----------+  |
|  | Pages    |  | Layouts  |  | API      |  | Middleware |  |
|  | (RSC)    |  | (Shell)  |  | Routes   |  | (Auth)    |  |
|  +----------+  +----------+  +----------+  +-----------+  |
+-----------------------------------------------------------+
                          |
+-----------------------------------------------------------+
|                   Business Logic Layer                      |
|  +------------------+  +------------------+               |
|  | Calculation      |  | MRV Pipeline     |               |
|  | Engine           |  | (Lineage)        |               |
|  +------------------+  +------------------+               |
|  +------------------+  +------------------+               |
|  | Audit Trail      |  | Unit Conversion  |               |
|  | Service          |  | Service          |               |
|  +------------------+  +------------------+               |
+-----------------------------------------------------------+
                          |
+-----------------------------------------------------------+
|                   Data Access Layer                         |
|  +------------------+  +------------------+               |
|  | Drizzle ORM      |  | Supabase Client  |               |
|  | (Type-safe)      |  | (Auth + Storage) |               |
|  +------------------+  +------------------+               |
+-----------------------------------------------------------+
                          |
+-----------------------------------------------------------+
|              PostgreSQL (Supabase) + RLS                    |
+-----------------------------------------------------------+
```

## Data Flow

1. User submits emission data via form
2. Middleware validates authentication and company context
3. API route validates input with Zod schemas
4. Calculation engine processes activity data
5. Results stored in database with audit entry
6. RLS ensures tenant isolation
7. Dashboard updates with new totals

## Security Model

- **Authentication**: Supabase Auth (JWT tokens)
- **Authorization**: RBAC with 7 roles and granular permissions
- **Multi-tenancy**: Row-Level Security on all tables
- **Audit**: Immutable append-only audit log
- **API Security**: Rate limiting, input validation (Zod)
- **Data Protection**: Encryption at rest (Supabase), TLS in transit

## Multi-Tenancy Approach

- Each company has a unique UUID
- All data tables include `company_id` column
- RLS policies filter by authenticated user's company
- Service role bypasses RLS for system operations

## Calculation Engine Design

The engine follows a pipeline pattern:
1. Input validation (Zod schema)
2. Unit normalization
3. Emission factor lookup (versioned)
4. Gas-by-gas calculation (CO2, CH4, N2O)
5. GWP application (AR5 or AR6)
6. Uncertainty propagation
7. Data quality scoring
8. Result with full audit trail

## Integration Points

- **Supabase**: Database, Auth, Storage, Realtime
- **OpenAI**: AI-powered data extraction and analysis
- **Vercel**: Hosting, Edge Functions, Analytics
- **External EF APIs**: Future integration for live factor updates
