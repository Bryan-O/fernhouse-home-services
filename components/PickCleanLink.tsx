'use client';

import { pickClean } from '@/lib/booking-store';
import type { CleanService } from '@/lib/config';

/** Link to the home-cleaning booking card that also picks a type of clean. */
export function PickCleanLink({ service, href = '#booking', className, children }: {
  service?: CleanService;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a className={className} href={href} onClick={() => pickClean(service ? { service } : {})}>
      {children}
    </a>
  );
}
