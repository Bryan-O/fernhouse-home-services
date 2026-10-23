import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { captureAttribution, cleanLocation, readAttribution, trackablePage } from './attribution';
import { capiPayload, fbcFrom } from './meta-capi';

// A tiny browser for the node test runner.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    document: { cookie: '_ga=GA1.1.1; _fbp=fb.1.1761200000000.1234567890' },
  });
  setNavigator({});
});
// Node has a read-only navigator; replace it for each test.
const setNavigator = (n: object) => Object.defineProperty(globalThis, 'navigator', { value: n, configurable: true });

describe('attribution', () => {
  it('keeps UTM tags and click ids from the landing address; last click wins', () => {
    captureAttribution('?utm_source=facebook&utm_campaign=fall&fbclid=IwAR123&x=1');
    expect(readAttribution()).toEqual({ utm_source: 'facebook', utm_campaign: 'fall', fbclid: 'IwAR123', fbp: 'fb.1.1761200000000.1234567890', ads_ok: true });
    captureAttribution('?gclid=Cj0K');
    expect(readAttribution()).toMatchObject({ gclid: 'Cj0K' });
    expect(readAttribution().utm_source).toBeUndefined();
  });
  it('ignores addresses without any, and expires after 30 days', () => {
    captureAttribution('?utm_source=google');
    captureAttribution('?page=2');
    expect(readAttribution().utm_source).toBe('google');
    expect(readAttribution(Date.now() + 31 * 86400_000).utm_source).toBeUndefined();
  });
  it('Global Privacy Control: no click ids, no _fbp, ads off', () => {
    setNavigator({ globalPrivacyControl: true });
    captureAttribution('?utm_source=facebook&fbclid=IwAR123');
    expect(readAttribution()).toEqual({ utm_source: 'facebook', ads_ok: false });
  });
  it('only public pages are tracked, without private query strings', () => {
    expect(trackablePage('/')).toBe(true);
    expect(trackablePage('/book/confirmed')).toBe(true);
    for (const p of ['/b/abc', '/job/abc', '/admin', '/admin/pros']) expect(trackablePage(p)).toBe(false);
    expect(cleanLocation('https://fernhouseclean.com/book/confirmed?session_id=cs_test_secret&utm_source=fb')).toBe('https://fernhouseclean.com/book/confirmed?utm_source=fb');
    expect(cleanLocation('https://fernhouseclean.com/?fbclid=x')).toBe('https://fernhouseclean.com/');
  });
});

describe('Meta Conversions API payload', () => {
  it('hashes the email, never sends a phone, and carries the dedupe id', () => {
    const p = capiPayload({ name: 'Purchase', id: 'FH-26-01001', time: new Date('2026-10-23T12:00:00Z'), url: 'https://fernhouseclean.com/book', value: 132, email: ' Jordan@Example.com ', externalId: 'c1', fbc: fbcFrom('IwAR123', '2026-10-23T12:00:00Z'), fbp: 'fb.1.1.2' });
    const e = p.data[0];
    expect(e).toMatchObject({ event_name: 'Purchase', event_id: 'FH-26-01001', event_time: 1792756800, action_source: 'website', custom_data: { currency: 'USD', value: 132 } });
    // sha256 of the trimmed, lower-cased address
    expect(e.user_data.em).toEqual([createHash('sha256').update('jordan@example.com').digest('hex')]);
    expect(e.user_data.fbc).toBe('fb.1.1792756800000.IwAR123');
    expect(JSON.stringify(p)).not.toMatch(/ph"|jordan@example\.com|Jordan/);
  });
  it('same email, any case or spacing, hashes the same', () => {
    const a = capiPayload({ name: 'Lead', id: 'q', time: new Date(), url: 'x', email: 'a@b.co' }).data[0].user_data.em;
    const b = capiPayload({ name: 'Lead', id: 'q', time: new Date(), url: 'x', email: ' A@B.CO ' }).data[0].user_data.em;
    expect(a).toEqual(b);
  });
});
