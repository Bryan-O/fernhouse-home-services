'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
import { TRACKING } from '@/lib/config';

/** GA4 purchase, once per booking (a reload doesn't count twice). Meta gets it from the server. */
export function PurchaseEvent({ refId, value, item }: { refId: string; value: number; item: string }) {
  useEffect(() => {
    const key = `ga-purchase-${refId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      // storage blocked: send it anyway
    }
    // The analytics queue is set up by <Analytics /> just before; wait a tick for it.
    const t = setTimeout(() => trackEvent({ name: 'purchase', params: { transaction_id: refId, currency: TRACKING.currency, value, items: [{ item_name: item }] } }), 50);
    return () => clearTimeout(t);
  }, [refId, value, item]);
  return null;
}
