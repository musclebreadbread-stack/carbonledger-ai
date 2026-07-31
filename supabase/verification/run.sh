#!/usr/bin/env bash
# Applies 0001 -> 0005 to a throwaway Postgres 16 and runs the RLS assertions as
# a non-owner role. Must run start-to-finish in one shell: the sandbox does not
# keep containers alive between commands.
set -uo pipefail

# Unique per run and removed by the trap: a container left behind by an aborted
# run must not make the next run fail on a name collision.
CONTAINER="carbonledger-rls-$$"
cd "$(dirname "$0")/../.."

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=carbonledger \
  postgres:16-alpine >/dev/null || { echo "could not start postgres"; exit 1; }

for _ in $(seq 1 60); do
  sleep 1
  docker exec "$CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && break
done
docker exec "$CONTAINER" pg_isready -U postgres || { echo "postgres never became ready"; exit 1; }
echo "postgres: $(docker exec "$CONTAINER" psql -U postgres -tAc 'select version()' | cut -c1-25)"
echo

psql_file() {
  docker exec -i "$CONTAINER" psql -U postgres -d carbonledger -v ON_ERROR_STOP=1 -q < "$1"
}

for f in \
  supabase/verification/auth-stub.sql \
  supabase/migrations/0001_initial_schema.sql \
  supabase/migrations/0002_rls_policies.sql \
  supabase/migrations/0003_rls_policies_phase2.sql \
  supabase/migrations/0004_target_progress_uniqueness.sql \
  supabase/migrations/0005_restrict_emission_factor_writes.sql \
  supabase/verification/roles.sql \
  supabase/verification/seed.sql
do
  if out=$(psql_file "$f" 2>&1); then
    echo "applied  $f"
  else
    echo "FAILED   $f"
    echo "$out" | tail -12
    exit 1
  fi
done

echo
echo "policy count by table"
docker exec "$CONTAINER" psql -U postgres -d carbonledger -c "
  SELECT t.tablename,
         c.relrowsecurity AS rls,
         count(p.policyname) AS policies
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.tablename
  WHERE t.schemaname = 'public'
  GROUP BY 1, 2 ORDER BY 3, 1;"

echo
echo "=========== RLS ASSERTIONS ==========="
out=$(psql_file supabase/verification/assertions.sql 2>&1)
status=$?
echo "$out" | grep -E '^(NOTICE|ERROR|psql:)' | sed -e 's/^NOTICE:  //'
echo
if [ "$status" -eq 0 ]; then
  echo "RESULT: all assertions passed (psql exit $status)"
else
  echo "RESULT: FAILED (psql exit $status)"
fi

exit "$status"
