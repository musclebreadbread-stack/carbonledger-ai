# CarbonLedger AI

Enterprise-grade AI-powered Greenhouse Gas (GHG) Integrated Management Platform.
ISO 14064 / GHG Protocol compliant. Multi-tenant SaaS architecture.

## Architecture Overview

```
+------------------------------------------------------------------+
|                     CarbonLedger AI Platform                       |
+------------------------------------------------------------------+
|                                                                    |
|  +------------------+  +------------------+  +-----------------+  |
|  |   Next.js 16     |  |  Calculation     |  |   MRV Engine    |  |
|  |   App Router     |  |  Engine          |  |   (Measure,     |  |
|  |   (React 19)     |  |  (ISO 14064)     |  |   Report,       |  |
|  |                  |  |                  |  |   Verify)       |  |
|  +------------------+  +------------------+  +-----------------+  |
|                                                                    |
|  +------------------+  +------------------+  +-----------------+  |
|  |   Auth / RBAC    |  |  Audit Trail     |  |   i18n          |  |
|  |   (Supabase)     |  |  (Immutable)     |  |   (ko,en,ja,zh) |  |
|  +------------------+  +------------------+  +-----------------+  |
|                                                                    |
+------------------------------------------------------------------+
|                     Supabase (PostgreSQL + Auth + RLS)             |
+------------------------------------------------------------------+
```

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL via Supabase |
| ORM | Drizzle ORM |
| Auth | Supabase Auth + RBAC |
| UI Components | shadcn/ui + Radix UI |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Testing | Vitest + Playwright |
| i18n | next-intl (ko, en, ja, zh) |
| Deployment | Vercel + Supabase Cloud |
| CI/CD | GitHub Actions |
| Container | Docker multi-stage build |

## Features

### Core Features
- **GHG Calculation Engine**: ISO 14064 / GHG Protocol compliant calculations
  - Scope 1: Stationary combustion, mobile combustion, fugitive emissions, process emissions
  - Scope 2: Location-based and market-based methods
  - Scope 3: 15 categories with spend-based and activity-based approaches
- **Unit Conversion Service**: Energy, mass, volume, distance, emission unit conversions
- **Emission Factor Management**: Korea MOE, IPCC 2006, UK DEFRA 2023 databases
- **Uncertainty & Data Quality**: IPCC error propagation, GHG Protocol quality scoring

### Platform Features
- **Multi-tenant SaaS**: Row-Level Security (RLS) isolation per company
- **Role-Based Access Control**: 7 roles with granular permissions
- **Audit Trail**: Immutable, append-only system activity log
- **MRV Pipeline**: Measurement, Reporting, Verification with data lineage tracking
- **Workflow Engine**: Approval workflows for emission records and reports
- **Dashboard**: Real-time KPI cards, trend charts, scope breakdown
- **Reporting**: ISO 14064, CDP, GRI 305, custom report generation
- **Internationalization**: Korean, English, Japanese, Chinese support

## Project Structure

```
src/
  app/                          # Next.js App Router
    (auth)/                     # Auth pages (login, register)
    (dashboard)/                # Dashboard pages
    api/v1/                     # REST API routes
  components/
    ui/                         # shadcn/ui components
    features/                   # Domain-specific components
    providers/                  # Context providers
  lib/
    auth/                       # Authentication & RBAC
    calculation-engine/         # GHG calculation engine
    unit-conversion/            # Unit conversion service
    audit/                      # Audit trail service
    mrv/                        # MRV pipeline
    db/                         # Database (Drizzle ORM)
  constants/
    emission-factors/           # Emission factor databases
  i18n/                         # Internationalization config
  messages/                     # Translation files
  types/                        # TypeScript type definitions
tests/                          # Test files
supabase/
  migrations/                   # Database migrations
  functions/                    # Edge Functions (Deno, own toolchain)
    _shared/                    # Pure logic: auth, validation, aggregation
    supplier-intake/            # Public supplier submission endpoint
    supplier-request-reminders/ # Scheduled: issue and chase data requests
    target-progress-rollup/     # Scheduled: recompute target_progress
  seed.sql                      # Sample data
docs/                           # Documentation
.github/workflows/              # CI/CD pipelines
```

Edge Functions are Deno and are deliberately excluded from `tsconfig.json`,
ESLint and Prettier; `deno task verify` in `supabase/functions/` runs their
formatting, lint, type check and tests. See
[Edge Functions](./edge-functions.md).

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- Supabase account (or local Supabase)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/musclebreadbread-stack/carbonledger-ai.git
cd carbonledger-ai

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Start development server
pnpm dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Production/Supabase mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key; must be set with the URL | Production/Supabase mode |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key | DB/administrative operations |
| `DATABASE_URL` | PostgreSQL connection string | Migrations and DB operations |
| `ENABLE_DEMO_MODE` | Explicit production demo opt-in; never enable for real production data | No (local demo is automatic) |
| `DEMO_SESSION_SECRET` | Signed demo-cookie key | Required for any non-local demo |
| `OPENAI_API_KEY` | OpenAI API key (AI features) | Optional |
| `SUPPLIER_PORTAL_TOKEN_SECRET` | HMAC key for supplier submission tokens | Edge Functions |
| `EDGE_CRON_SECRET` | Shared secret for the scheduled functions | Edge Functions |
| `SUPPLIER_NOTIFICATION_WEBHOOK_URL` | Where supplier reminder digests are POSTed | Optional |

Local development enters demo mode only when both Supabase public variables are absent
(and `ENABLE_DEMO_MODE` is not `false`). Production fails closed unless Supabase is fully
configured or demo mode is explicitly opted into. A partial Supabase configuration never
falls back to demo. The Edge Function secrets are set with `supabase secrets set`, not in
Vercel — see [Edge Functions](./edge-functions.md).

### Development Commands

```bash
pnpm dev          # Start dev server (Turbopack)
pnpm build        # Production build
pnpm start        # Start production server
pnpm test         # Run unit tests (Vitest)
pnpm test:e2e     # Run E2E tests (Playwright)
pnpm lint         # ESLint check
pnpm typecheck    # TypeScript type check
pnpm format       # Prettier format
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio
```

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to `main`

See [Deployment Guide](./deployment-guide.md) for detailed instructions.

### Docker

```bash
# Build production image
docker build -t carbonledger-ai .

# Run with docker-compose
docker-compose up -d
```

## Calculation Engine

The calculation engine implements ISO 14064 and GHG Protocol methodologies:

### Scope 1 (Direct Emissions)
- **Stationary Combustion**: Fuel consumption x NCV x Emission Factor
- **Mobile Combustion**: Fuel consumed x Emission Factor
- **Fugitive Emissions**: Refrigerant leaked x GWP
- **Process Emissions**: Activity data x Process-specific EF

### Scope 2 (Energy Indirect)
- **Location-based**: Electricity x Grid EF (country/region)
- **Market-based**: Electricity x Supplier-specific EF

### Scope 3 (Other Indirect)
- 15 categories supported (purchased goods, business travel, waste, etc.)
- Spend-based, activity-based, and hybrid methods

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run specific test file
pnpm test tests/lib/calculation-engine/calculator.test.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit changes (`git commit -m 'feat: add feature'`)
4. Push to branch (`git push origin feat/my-feature`)
5. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `chore:` - Build/tooling changes
- `refactor:` - Code restructuring
- `test:` - Adding/modifying tests

## License

This project is proprietary. All rights reserved.

## Support

- Technical issues: Create a GitHub Issue
- Security vulnerabilities: Email security@carbonledger.ai
- General questions: Contact the development team
