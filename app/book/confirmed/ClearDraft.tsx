'use client';

import { useEffect } from 'react';

/** The booking is done: forget this tab's draft (it holds contact details and access notes). */
export function ClearDraft() {
  useEffect(() => {
    try {
      window.sessionStorage.removeItem('booking-draft');
    } catch {
      // Storage blocked: nothing to clear.
    }
  }, []);
  return null;
}
