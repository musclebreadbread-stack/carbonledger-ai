#!/usr/bin/env bash
# Applies supabase/migrations to the compose `db` service on first boot.
#
# Mounting supabase/migrations straight into /docker-entrypoint-initdb.d does not
# work, for two reasons:
#
#   1. The migrations have to run after an `auth` schema exists. 0002 does
#      `CREATE OR REPLACE FUNCTION auth.user_company_id()` and a plain Postgres
#      image has no `auth` schema, so initdb fails on the second file. The
#      compose file mounts supabase/verification/auth-stub.sql as
#      00-auth-stub.sql, which sorts before this script.
#
#   2. initdb ignores directories, so the migrations directory is mounted at
#      /migrations and iterated here instead.
#
# ON_ERROR_STOP is the point of the script: without it psql reports a failed
# statement and carries on, and the container ends up healthy with a schema that
# is quietly incomplete.
set -euo pipefail

shopt -s nullglob
migrations=(/migrations/*.sql)
if [ ${#migrations[@]} -eq 0 ]; then
  echo "10-apply-migrations: no migrations found at /migrations" >&2
  exit 1
fi

# Filename order is the apply order: 0001 -> 0002 -> 0003 -> 0004. Sorted
# explicitly rather than relying on the shell's collation.
while IFS= read -r file; do
  echo "10-apply-migrations: applying ${file}"
  psql -v ON_ERROR_STOP=1 --no-psqlrc \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$file"
done < <(printf '%s\n' "${migrations[@]}" | LC_ALL=C sort)

echo "10-apply-migrations: applied ${#migrations[@]} migration(s)"
