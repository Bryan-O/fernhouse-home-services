'use client';

import { useEffect, useState } from 'react';
import { THEME_KEY } from '@/lib/theme';

// Auto follows the device; Light / Dark are remembered in this browser. The script in
// app/layout.tsx applies a saved choice before the first paint, so there is no flash.
type Theme = 'auto' | 'light' | 'dark';
const OPTIONS: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

function apply(t: Theme) {
  const root = document.documentElement;
  try {
    if (t === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // Storage blocked (private mode): the choice still applies to this page.
  }
  if (t === 'auto') delete root.dataset.theme;
  else root.dataset.theme = t;
}

/** Auto / Light / Dark switch for the footers. `onDark` styles it for the dark footer. */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const [theme, setTheme] = useState<Theme>('auto');
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === 'light' || t === 'dark') setTheme(t);
  }, []);
  return (
    <div role="group" aria-label="Colour theme" className={onDark ? 'theme-toggle theme-toggle-dark' : 'theme-toggle'}>
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" aria-pressed={theme === o.id} onClick={() => { setTheme(o.id); apply(o.id); }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
