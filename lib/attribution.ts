'use client';

import { TRACKING } from './config';

// Where a visitor came from (UTM tags, Google/Meta click IDs), kept in this browser for 30 days
// and sent with a booking or quote. Last click wins. Global Privacy Control turns ad tracking off.

export const ATTRIBUTION_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'] as const;
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type Attribution = Partial<Record<AttributionKey | 'fbp', string>> & { ads_ok?: boolean };

const STORE = 'fh-attribution';

/** True unless the browser sends Global Privacy Control (a "don't sell or share" signal). */
export function adsAllowed(): boolean {
  return typeof navigator === 'undefined' || !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
}

/** Save UTM tags and click IDs from the current address, if it has any. */
export function captureAttribution(search: string = typeof location === 'undefined' ? '' : location.search): void {
  const q = new URLSearchParams(search);
  const found: Partial<Record<AttributionKey, string>> = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = q.get(k)?.trim();
    if (v) found[k] = v.slice(0, 200);
  }
  if (!Object.keys(found).length) return;
  if (!adsAllowed()) { delete found.fbclid; delete found.gclid; }
  try {
    localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), v: found }));
  } catch {
    // storage blocked: nothing to keep
  }
}

/** What to send with a booking or quote. */
export function readAttribution(now = Date.now()): Attribution {
  const ads = adsAllowed();
  let saved: Partial<Record<AttributionKey, string>> = {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? 'null') as { at: number; v: Partial<Record<AttributionKey, string>> } | null;
    if (raw && now - raw.at < TRACKING.attributionDays * 86400_000) saved = raw.v;
  } catch {
    // ignore
  }
  const fbp = ads ? document.cookie.match(/(?:^|;\s*)_fbp=(fb\.\d\.\d+\.\d+)/)?.[1] : undefined;
  return { ...saved, ...(ads ? {} : { fbclid: undefined, gclid: undefined }), ...(fbp ? { fbp } : {}), ads_ok: ads };
}

/** Is this page one where analytics may load? */
export function trackablePage(path: string): boolean {
  return (TRACKING.pages as readonly string[]).includes(path);
}

/** The address sent to analytics: no query string except UTM tags. */
export function cleanLocation(href: string): string {
  const u = new URL(href);
  const keep = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (k.startsWith('utm_')) keep.set(k, v);
  const q = keep.toString();
  return `${u.origin}${u.pathname}${q ? `?${q}` : ''}`;
}
