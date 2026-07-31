# Supabase Edge Functions

Three functions live in `supabase/functions/`. They are Deno, not Node, and share
none of the Next.js toolchain — see [Toolchain](#toolchain) for what that means in
practice.

## Why these three

An Edge Function is only the right answer when the work cannot sit in the Next.js
app. Each of these fails that test for a specific, stated reason.

| Function | Trigger | Why it cannot be a Next.js route |
|----------|---------|----------------------------------|
| `supplier-intake` | Supplier, `POST` | Suppliers hold no Supabase identity, so no RLS policy can ever admit them |
| `supplier-request-reminders` | Schedule | Nothing performs the `pending -> sent` transition the lifecycle requires |
| `target-progress-rollup` | Schedule | `target_progress` has no writer anywhere in the codebase |

### `supplier-intake`

`supabase/migrations/0003_rls_policies_phase2.sql` states the constraint plainly:

> Suppliers themselves are not users of this system and hold no JWT, so there is
> no supplier-side policy to write.

That is not an omission to be corrected later — it is a deliberate boundary. A
supplier is an outside party, and the alternatives to a server-side endpoint are
all worse than one: granting the `anon` role write access to
`supplier_data_requests` would expose every tenant's requests, and creating a
Supabase user per supplier would put outside parties inside a tenant's user table
and its RBAC.

So the intake runs as `service_role`, authenticates the supplier with an
HMAC-signed capability token bound to one request, one supplier and one company,
and enforces tenancy itself.

**What it will not do**, and these are the important part:

- it does not write `supplier_emissions`. Promoting a figure into the inventory is
  *verification*, a reviewer's act. A supplier reaching it would make the "only
  verified submissions count towards reported Scope 3" rule in
  `src/lib/suppliers/types.ts` meaningless;
- it does not set a data quality score, which is assessed at verification;
- it does not overwrite an existing submission — a replay gets `409` with the
  first submission's timestamp.

### `supplier-request-reminders`

The documented lifecycle is
`pending -> sent -> in_progress -> submitted -> verified | rejected`, and nothing
in the application ever performs the first step. A request created by staff sits
at `pending` for ever, the supplier is never told, and `responseRatePercent`
counts it as unanswered. Nothing chases an overdue request either.

The job issues those transitions and reports what is overdue or due soon. Its
definition of overdue is taken from `isOverdue` in `src/lib/suppliers/types.ts`
rather than reinvented: **a `submitted` request past its due date is not supplier
lateness**, it is our own verification backlog, and counting it would misattribute
our delay to them.

### `target-progress-rollup`

`target_progress` is the one table with policies, a matching TypeScript model and a
page that renders it — and nothing that has ever written to it. Every figure on
`/targets` today comes from sample data, and reduction-target progress is what goes
into a CDP response or an SBTi progress report.

The job recomputes it from **approved** emission records only. Anything earlier in
the workflow is a proposal, and progress published from proposals is the same
mistake as counting unverified supplier figures, in a more consequential place.

Two things it refuses to guess at:

- **intensity targets are skipped.** Their `base_emissions` is tCO2e per unit of
  output and the schema stores no output denominator anywhere. Writing absolute
  tonnes into an intensity target's progress would compare tonnes against
  tonnes-per-unit and report a healthy company as catastrophically off track. The
  response names each skipped target and the reason.
- **fiscal years are not handled.** `companies.fiscal_year_start` exists; this job
  uses calendar years. A company reporting on a non-January fiscal year needs that
  read, and it is not implemented.

## Tenancy: read this before editing a query

`service_role` has `BYPASSRLS`. **Every policy in `0002` and `0003` is inert for
these functions.** The tenancy guarantee the platform rests on —
`company_id = auth.user_company_id()` — does not apply to a single query in this
directory.

The rules that replace it:

1. every query filters on `company_id` explicitly, without exception;
2. a row is looked up by `id` **and** `company_id`, never by `id` alone, even when
   the id arrived in a signed token. If the two disagree the lookup must miss;
3. the two scheduled jobs legitimately span tenants, so they keep results
   **grouped per company** and never merge them into one list. One tenant's
   overdue suppliers cannot appear in another's digest because they are never in
   the same array;
4. writes repeat the tenant predicate alongside the row ids, so a write is safe to
   read in isolation.

There is no second line of defence behind these rules.

## Prerequisites

- Supabase CLI (`npx supabase --version`)
- A linked project: `npx supabase link --project-ref <ref>`
- Deno, only for running the checks locally: <https://docs.deno.com/runtime/getting_started/installation/>

## Migrations first

`target-progress-rollup` upserts on `(target_id, year)`, which needs the unique
index added by `supabase/migrations/0004_target_progress_uniqueness.sql`. Deploy the
function without it and every invocation fails with *"there is no unique or
exclusion constraint matching the ON CONFLICT specification"*.

```bash
npx supabase db push
```

## Secrets

Two variables are injected by the platform and must **not** be set by hand:
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The rest are set once per project:

| Secret | Used by | Notes |
|--------|---------|-------|
| `SUPPLIER_PORTAL_TOKEN_SECRET` | `supplier-intake` | HMAC key for submission tokens. 32+ random bytes. |
| `EDGE_CRON_SECRET` | both scheduled functions | Shared secret the scheduler presents. |
| `SUPPLIER_NOTIFICATION_WEBHOOK_URL` | `supplier-request-reminders` | Optional. Unset means no digest is sent. |

```bash
npx supabase secrets set \
  SUPPLIER_PORTAL_TOKEN_SECRET="$(openssl rand -hex 32)" \
  EDGE_CRON_SECRET="$(openssl rand -hex 32)"
```

A missing secret is a hard `500` with code `not_configured`, never a silent
fallback: treating an absent `SUPPLIER_PORTAL_TOKEN_SECRET` as an empty string
would make the function accept every forged token.

**Rotating `SUPPLIER_PORTAL_TOKEN_SECRET` invalidates every outstanding submission
token at once.** That is the revocation mechanism — signed tokens carry their own
claims and are not individually revocable — so rotation means re-sending links to
every supplier with an open request.

## Deploy

`verify_jwt` is set per function in `supabase/config.toml` and the CLI reads it
from there, so no flags are needed:

```bash
npx supabase functions deploy supplier-intake
npx supabase functions deploy supplier-request-reminders
npx supabase functions deploy target-progress-rollup
```

`supplier-intake` is configured with `verify_jwt = false`. That is not an oversight
to be tightened: with JWT verification on, the platform rejects the request before
the function runs and the intended caller — a supplier with no Supabase identity —
could never submit anything. The token check inside the function is what replaces
it.

Deploying all three at once (`npx supabase functions deploy`) also works but
applies the same command to every function, so the per-function config above is
what keeps the JWT settings correct.

## Scheduling

Both scheduled functions are driven by `pg_cron` calling out through `pg_net`. Run
this **in the SQL editor, not as a migration** — it embeds the project ref and a
secret, neither of which belongs in version control.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Nightly at 02:15 UTC: chase suppliers.
select cron.schedule(
  'supplier-request-reminders',
  '15 2 * * *',
  $$
  select net.http_post(
    url     := 'https://<project-ref>.functions.supabase.co/supplier-request-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <anon-or-service-key>',
      'x-cron-secret', '<EDGE_CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Nightly at 03:15 UTC: recompute target progress for the current year.
select cron.schedule(
  'target-progress-rollup',
  '15 3 * * *',
  $$
  select net.http_post(
    url     := 'https://<project-ref>.functions.supabase.co/target-progress-rollup',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer <anon-or-service-key>',
      'x-cron-secret', '<EDGE_CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

The `x-cron-secret` header is the real gate, not `Authorization`. With
`verify_jwt = true` the platform accepts *any* valid project JWT — including the
anon key that ships in the browser bundle — so a job that rewrites every tenant's
reported progress would otherwise be triggerable by anyone who read the front
end's JavaScript.

**January closing.** The rollup defaults to the current UTC year. Recomputing the
year that just ended needs an explicit `{"year": 2024}`, which is deliberate:
rolling over automatically on 1 January would freeze December's figures a day
before the late approvals that normally follow it. Schedule a separate January job
for the prior year, or trigger it by hand after the books close.

To remove a schedule: `select cron.unschedule('target-progress-rollup');`

## Calling the functions

### `supplier-intake`

```bash
curl -sS -X POST \
  "https://<project-ref>.functions.supabase.co/supplier-intake" \
  -H 'Content-Type: application/json' \
  -d '{
    "token": "v1.<payload>.<signature>",
    "reportedEmissions": 1980.25,
    "methodology": "supplier_specific",
    "period": "2024",
    "evidenceUrl": "https://example.com/verification-statement.pdf",
    "notes": "Measured, third-party assured."
  }'
```

`202 Accepted` on success. `methodology` must be one of `supplier_specific`,
`average_data`, `spend_based`, `activity_based`, `hybrid`. `period` is optional and,
when present, must equal the request's own period — a supplier filing 2023 figures
against a 2024 request is a real mistake that nothing downstream could detect.

| Status | Code | Meaning |
|--------|------|---------|
| 202 | — | Recorded; the request is now `submitted` |
| 400 | `invalid_json`, `invalid_payload` | Body is not a JSON object |
| 401 | `invalid_token` | Expired, forged, or pointing at nothing |
| 405 | `method_not_allowed` | Only `POST` |
| 409 | `already_submitted` | A submission is already on file |
| 413 | `body_too_large` | Over 64 KiB |
| 422 | `invalid_emissions`, `emissions_out_of_range`, `invalid_methodology`, `period_mismatch`, `invalid_evidence_url`, `notes_too_long` | Contents not acceptable |
| 500 | `not_configured` | A secret is unset |
| 502 | `lookup_failed`, `write_failed` | The database call failed |

Every token failure returns the same `invalid_token`, and a token that verifies but
points at a non-existent request returns it too. Distinguishing "expired" from
"forged" from "no such request" would be an oracle for probing which request ids
exist, and the supplier's remedy is the same in all three cases: ask for a new
link.

Error bodies are `{"error": {"code": "...", "message": "..."}}`. The **code** is the
contract; `message` is for logs. The portal renders codes through
`src/messages/*.json`, so an English sentence from a function would be an
untranslated string in a Korean UI.

### Issuing a submission token

Tokens are minted with `signSupplierToken` in
`supabase/functions/_shared/auth.ts` — the same module that verifies them, so the
two halves cannot drift apart. Claims are `requestId`, `supplierId`, `companyId`
and `exp` (seconds since the epoch); the maximum accepted lifetime is 30 days, and
a validly signed token claiming more is refused so that an issuing bug becomes a
visible failure rather than a standing credential.

### The scheduled functions

```bash
# Dry run: reports what would change without writing anything.
curl -sS -X POST \
  "https://<project-ref>.functions.supabase.co/supplier-request-reminders" \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: <EDGE_CRON_SECRET>' \
  -d '{"dryRun": true, "dueSoonDays": 14}'

# One tenant, one year.
curl -sS -X POST \
  "https://<project-ref>.functions.supabase.co/target-progress-rollup" \
  -H 'Content-Type: application/json' \
  -H 'x-cron-secret: <EDGE_CRON_SECRET>' \
  -d '{"companyId": "<uuid>", "year": 2024}'
```

Both accept an empty body. `supplier-request-reminders` takes `companyId`, `asOf`,
`dueSoonDays` (0-365) and `dryRun`; `target-progress-rollup` takes `companyId` and
`year`. Omitting `companyId` processes every company, one at a time.

`target-progress-rollup` returns `207` when some tenants succeeded and others
failed, so a scheduler cannot record a clean run over a job that half worked. The
rollup is idempotent: re-running it for the same year updates the existing rows
rather than appending, which is the intended way to correct a figure after a late
approval.

## Toolchain

Edge Functions run on Deno and are excluded from the Next.js toolchain, because
`.ts` import specifiers, the `Deno` global and `npm:`/`jsr:` resolution are not
valid input to it:

- `tsconfig.json` excludes `supabase/functions` — without this `pnpm typecheck`
  fails with `TS2304: Cannot find name 'Deno'` and 15 more errors;
- `eslint.config.mjs` ignores `supabase/functions/**`;
- `.prettierignore` excludes it, because `deno fmt` owns the formatting and two
  formatters with different opinions would fight over every file;
- Vitest never matched it (`tests/**` is the repository-root `tests/` directory
  only), so `vitest.config.ts` is untouched.

Deno's own checks live in `supabase/functions/deno.json`:

```bash
cd supabase/functions
deno task verify   # fmt --check, lint, type check, tests
deno task test     # tests only
```

`deno task verify` is **not wired into `.github/workflows/ci.yml`**. The CI jobs all
run on the pnpm toolchain, which by design cannot see this directory, so these
checks are currently a local step only. Adding a Deno job to CI is the obvious
follow-up and is deliberately left out of the change that introduced these
functions.

Business logic sits in `_shared/` as pure functions — token verification,
submission validation, reminder planning, progress arithmetic — with the database
calls confined to the three `index.ts` handlers. That is what makes the logic
testable without a database, and `deno task test` covers it.

## What is not implemented

Stated rather than left to be discovered:

- **No rate limiting on `supplier-intake`.** It is a public endpoint. Per-token
  throttling needs shared state that a function invocation does not have; the
  practical mitigations today are the 64 KiB body cap, the short token lifetime,
  and Supabase's platform-level limits. A `pg`-backed counter or an upstream WAF
  rule is the real fix.
- **No email delivery.** The project configures no mail provider, so
  `supplier-request-reminders` performs its database transitions for real and
  POSTs a digest to `SUPPLIER_NOTIFICATION_WEBHOOK_URL` if that is set. With it
  unset the function still does its work and reports `notified: false`. Pointing
  that webhook at a mail service is a deployment decision.
- **No fiscal-year support in the rollup** (see above).
- **Intensity targets produce no progress rows** (see above).
- **The functions have not been executed against a live Supabase project.** The
  pure logic is covered by `deno task test`; the SQL in `0004` is verified against
  a real Postgres by `supabase/verification/run.sh`. The HTTP handlers' database
  calls are reviewed, not run.

## Local development

```bash
npx supabase start
npx supabase functions serve supplier-intake --env-file .env.local
```

`functions serve` reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the
local stack and everything else from `--env-file`. `.env.local` is gitignored;
`.env.example` lists the variables.
