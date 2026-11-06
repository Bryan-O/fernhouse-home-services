'use client';

import { useEffect, useState } from 'react';
import { THEME_KEY } from '@/lib/theme';

// Light is the default. Dark, or Auto (follow the device), is remembered in this browser; the
// script in app/layout.tsx applies it before the first paint, so there is no flash.
type Theme = 'auto' | 'light' | 'dark';
const OPTIONS: { id: Theme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' },
];

function apply(t: Theme) {
  const root = document.documentElement;
  try {
    if (t === 'light') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // Storage blocked (private mode): the choice still applies to this page.
  }
  if (t === 'light') delete root.dataset.theme;
  else root.dataset.theme = t;
}

/** Light / Dark / Auto switch for the footers. `onDark` styles it for the dark footer. */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === 'dark' || t === 'auto') setTheme(t);
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
