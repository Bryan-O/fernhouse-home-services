// Supabase connection settings, read from .env.local (never committed).
// Supabase calls the browser-safe key "publishable" (formerly "anon") and the
// server-only key "secret" (formerly "service_role"); either name works here.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True once the project URL and publishable key are set. */
export function supabaseConfigured(): boolean {
  return SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== '';
}
