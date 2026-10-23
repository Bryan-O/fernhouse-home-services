'use client';

import { useActionState } from 'react';
import { signIn, type SignInState } from '../actions';

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null, email: '' });
  return (
    <form action={action} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input type="hidden" name="next" value={next} />
      {state.error && (
        <p className="err" role="alert" id="signin-err">{state.error}</p>
      )}
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className="input" autoComplete="username" required
          defaultValue={state.email} aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'signin-err' : undefined} />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required
          aria-invalid={state.error ? true : undefined} aria-describedby={state.error ? 'signin-err' : undefined} />
      </div>
      <button type="submit" className="btn btn-primary btn-busy" disabled={pending} style={{ width: '100%' }}>
        {pending && <span className="spinner" aria-hidden="true" />}
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
