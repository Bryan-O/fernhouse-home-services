import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OwnerHeader } from '@/components/admin/OwnerHeader';
import { getOwner, safeAdminPath } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase/env';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = { title: 'Owner sign in', robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeAdminPath((await searchParams).next);
  const configured = supabaseConfigured();
  if (configured && (await getOwner())) redirect(next);

  return (
    <div style={{ background: 'var(--paper-2)', minHeight: '100vh' }}>
      <OwnerHeader signedIn={false} />
      <main className="wrap" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="card" style={{ maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 className="display" style={{ fontSize: 28, lineHeight: '34px' }}>Owner sign in</h1>
            <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>For the Fernhouse dashboard only.</p>
          </div>
          {configured ? (
            <SignInForm next={next} />
          ) : (
            <div className="notice small" role="status">
              <strong>Sign-in isn’t connected yet.</strong> Add the Supabase project URL and keys to <code>.env.local</code>, then restart the site.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
