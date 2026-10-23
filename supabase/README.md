# Supabase

The database schema lives in `migrations/` and runs in filename order. `config.toml` holds the auth settings:
- Public sign-ups are off.
- Passwords need at least 12 characters, with upper- and lower-case letters and digits.

## Connect the hosted project (once)

1. Create a project at supabase.com (the free tier is enough to start).
2. Copy **Project URL**, **Publishable key** and **Secret key** from Project Settings → API Keys into `.env.local` (see `.env.example`). Never commit `.env.local`.
3. Push the schema and auth settings:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   npx supabase config push
   ```
4. Create the owner account: Authentication → Users → **Add user** (email + password, auto-confirm). Then in the SQL editor:
   ```sql
   insert into admin_users (user_id) select id from auth.users where email = 'you@example.com';
   ```
5. Sign in at `/admin/login`.

## Test locally

- `npm run test:db` checks the business rules and row-level security in a throwaway Postgres. It needs no Docker and no account.
- `npx supabase start` runs the full local stack in Docker (Postgres, Auth, Storage) with demo keys.
