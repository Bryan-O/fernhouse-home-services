export const LOGIN_PATH = '/admin/login';

/** Only allow redirects back into /admin after login (no open redirects). */
export function safeAdminPath(next: string | null | undefined): string {
  return next && /^\/admin(\/[\w-]+)*\/?$/.test(next) && !next.startsWith(LOGIN_PATH) ? next : '/admin';
}
