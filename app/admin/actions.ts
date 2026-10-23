'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { supabaseConfigured } from '@/lib/supabase/env';
import { LOGIN_PATH, safeAdminPath } from '@/lib/auth';

export type SignInState = { error: string | null; email: string };

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!supabaseConfigured()) return { error: 'Sign-in isn’t connected yet.', email };
  if (!email || !password) return { error: 'Enter your email and password.', email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Same message for an unknown email or a wrong password.
    return { error: 'That email and password don’t match an owner account.', email };
  }
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { error: 'This account doesn’t have owner access.', email };
  }
  redirect(safeAdminPath(String(form.get('next') ?? '')));
}

export async function signOut() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(LOGIN_PATH);
}
