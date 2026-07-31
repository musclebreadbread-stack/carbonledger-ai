# RLS verification harness

Applies the migrations to a throwaway Postgres 16 container and then _exercises_
the Row Level Security policies as a non-owner role, rather than reading them and
hoping.

```bash
bash supabase/verification/run.sh
```

Exit status 0 means every assertion passed. Requires Docker.

## Why it exists

An RLS policy that looks right and is wrong reads exactly the same. The failure
mode that matters here is silent: a missing policy on a child table leaks every
tenant's rows and nothing complains. So the assertions seed two tenants, sign in
as four different users, and check what each can actually see and change.

## Files

| File             | Purpose                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-stub.sql`  | Supabase's `auth` schema, stubbed to the surface the migrations use: `auth.jwt()` reading claims out of a GUC, exactly as Supabase defines it. Not applied to a real Supabase project, which has the real thing. |
| `roles.sql`      | Creates `app_user`, a non-owner role. RLS is _not_ applied to superusers or to a table's owner, so running the assertions as `postgres` would pass no matter how broken the policies were.                       |
| `seed.sql`       | Two tenants with a row in every table `0003` governs, plus a completed and signed approval step, which is the row that has to be frozen. Not `supabase/seed.sql`, which is single-tenant sample data for local dev. |
| `assertions.sql` | The checks. Each raises on failure, so psql's exit status is the verdict.                                                                                                                                        |
| `run.sh`         | Starts the container, applies `auth-stub` → `0001` → `0002` → `0003` → `0004` → `0005` → `roles` → `seed`, prints the policy count per table, runs the assertions, removes the container.                        |

## What is asserted

- every governed table is company-scoped on read, and the visible row is the
  right tenant's rather than merely "one row";
- another tenant's rows are invisible even when addressed by primary key;
- cross-tenant `UPDATE`/`DELETE` affect zero rows, and an `INSERT` labelled with
  another tenant's `company_id` is refused outright;
- a `viewer` can read and cannot write; a `reviewer` can approve and cannot open
  a workflow;
- a completed, signed approval step cannot be re-signed, reassigned or deleted;
- a user cannot grant themselves site access, and an administrator cannot grant
  one of their users access to another tenant's site;
- reference data (`scope3_categories`, `unit_conversions`,
  `emission_factor_sets`) is readable by all and writable only by `super_admin`;
- the global `emission_factors` library stays readable by every tenant but is
  writable only by `super_admin`: a `company_admin` is refused on `INSERT` and
  affects zero rows on `UPDATE` and `DELETE`, and the seeded factor value is
  still intact afterwards. This is what `0005` exists to guarantee — with `0005`
  left out the `INSERT` check fails, which is the point of asserting it;
- a session with no JWT sees nothing;
- no table in `public` is left without RLS enabled or without a policy.

## Note on `docker-compose.yml`

The `db` service used to mount `supabase/migrations` straight into
`/docker-entrypoint-initdb.d`, which could not succeed: `0002_rls_policies.sql`
creates functions in the `auth` schema, and a plain Postgres has no `auth`
schema, so initdb failed on the second file.

It now applies `auth-stub.sql` first and then runs the migrations from
`/migrations` via `docker/initdb/10-apply-migrations.sh` — the same order this
harness uses. **`auth-stub.sql` is shared by both**, deliberately, so the two
cannot drift apart. It still does not belong in `supabase/migrations/`, where it
would collide with the real `auth.jwt()` on a Supabase project.

After the migrations, Compose applies the local-development sample data from
`supabase/seed.sql` as `/docker-entrypoint-initdb.d/20-seed.sql`. The numeric
prefix makes the order explicit, and Postgres initdb's error handling means a
schema/seed mismatch prevents the database from being marked ready instead of
leaving a partially seeded database.
