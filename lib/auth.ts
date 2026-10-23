import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from './supabase/server';
import { supabaseConfigured } from './supabase/env';
import { LOGIN_PATH } from './admin-paths';

export { LOGIN_PATH, safeAdminPath } from './admin-paths';

/** The signed-in user if they're on the owner list (admin_users), else null. */
export async function getOwner(): Promise<User | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error) throw new Error(`Owner check failed: ${error.message}`);
  return isAdmin === true ? user : null;
}

/** For owner-only pages and actions: send anyone else to the login page. */
export async function requireOwner(): Promise<User> {
  const owner = await getOwner();
  if (!owner) redirect(LOGIN_PATH);
  return owner;
}
