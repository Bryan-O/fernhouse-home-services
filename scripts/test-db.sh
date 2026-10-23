#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway local Postgres (with stand-ins for
# Supabase's auth/storage schemas) and runs the rule and row-level-security tests.
# Needs Postgres 16+ binaries on PATH or in /usr/lib/postgresql/*/bin.
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")
DIR=$(mktemp -d /tmp/fh-db-test.XXXXXX)
PORT=${PGPORT_TEST:-5439}
RUN=""
if [ "$(id -u)" = 0 ]; then chown postgres "$DIR"; RUN="su postgres -c"; fi
run() { if [ -n "$RUN" ]; then $RUN "$*"; else eval "$*"; fi; }
cleanup() { run "$PGBIN/pg_ctl -D $DIR/data -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
run "$PGBIN/initdb -D $DIR/data -A trust -U postgres" >/dev/null
run "$PGBIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start" >/dev/null
PSQL="psql -h $DIR -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
FAILED=0
for t in supabase/tests/*.sql; do
  [ "$(basename "$t")" = supabase-stub.sql ] && continue
  echo "== $t"
  $PSQL -c 'drop database if exists fh' -c 'create database fh'
  $PSQL -d fh -f supabase/tests/supabase-stub.sql
  for f in supabase/migrations/*.sql; do $PSQL -d fh -f "$f"; done
  OUT=$($PSQL -d fh -At -f "$t" | grep -v '^$')
  echo "$OUT"
  echo "$OUT" | tail -1 | grep -q '^0 failed' || FAILED=1
done
exit $FAILED
