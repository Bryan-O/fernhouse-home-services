#!/usr/bin/env bash
# Prints every migration, in order, as one script for Supabase → SQL Editor (no CLI needed).
# The editor runs a pasted script as one transaction, so each migration ends with a commit:
# later migrations use enum values that earlier ones add, which Postgres only allows once committed.
#   scripts/hosted-setup-sql.sh > fernhouse-database-setup.sql
set -euo pipefail
cd "$(dirname "$0")/.."
echo "-- Fernhouse database setup. Paste ALL of this into Supabase → SQL Editor → New query, then Run."
echo "-- Generated from supabase/migrations, in order. Run it once, on a new empty project."
for f in supabase/migrations/*.sql; do
  printf '\n-- ===== %s =====\n' "$(basename "$f")"
  cat "$f"
  printf '\ncommit;\n'
done
