'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { adsAllowed, captureAttribution, cleanLocation, trackablePage } from '@/lib/attribution';
import { TRACKING } from '@/lib/config';

const GA_ID = process.env.NEXT_PUBLIC_GA4_ID ?? '';
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '';

type Queue = ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown; disablePushState?: boolean };

/** Set up the gtag and fbq command queues; the libraries pick them up when they load. */
function setUp(pixel: boolean) {
  if (GA_ID && !window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { send_page_view: false });
  }
  if (pixel && !window.fbq) {
    const n: Queue = function fbq(...args: unknown[]) { if (n.callMethod) n.callMethod(...args); else n.queue!.push(args); };
    n.queue = []; n.loaded = true; n.version = '2.0'; n.push = n;
    n.disablePushState = true; // we send page views ourselves, without query strings
    window.fbq = n;
    (window as Window & { _fbq?: Queue })._fbq = n;
    n('set', 'autoConfig', false, PIXEL_ID);
    n('init', PIXEL_ID);
  }
}

/**
 * Google Analytics 4 and the Meta Pixel, on public pages only (lib/config.ts → TRACKING).
 * Page views are sent on each route change with the query string removed (UTM tags kept), so
 * nothing private in an address reaches either service. Off with Global Privacy Control.
 */
export function Analytics() {
  const path = usePathname();
  const [allowed, setAllowed] = useState(false);
  const trackable = trackablePage(path);
  const pixelHere = !!PIXEL_ID && !(TRACKING.noPixelPages as readonly string[]).includes(path);

  useEffect(() => {
    captureAttribution();
    setAllowed(adsAllowed());
  }, [path]);

  useEffect(() => {
    if (!allowed || !trackable) return;
    setUp(pixelHere);
    window.gtag?.('event', 'page_view', { page_location: cleanLocation(location.href), page_title: document.title });
    if (pixelHere) window.fbq?.('track', 'PageView');
  }, [allowed, trackable, pixelHere, path]);

  if (!allowed || !trackable) return null;
  return (
    <>
      {GA_ID && <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />}
      {pixelHere && <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" />}
    </>
  );
}
