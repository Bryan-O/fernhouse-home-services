#!/usr/bin/env bash
# Integration tests against the local Supabase stack (start it with: npx supabase start).
# Connection details come from the running stack, so no keys live in the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"
SUPABASE_INT=1 NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$PUBLISHABLE_KEY" SUPABASE_SECRET_KEY="$SECRET_KEY" \
  npx vitest run lib/*.int.test.ts
