'use client';

import { BOOKING } from '@/lib/config';
import { addDays, fmtLong, isBookableDate, isClosedDate, isFullDate, MONTH_NAMES, weekday, type Availability } from '@/lib/booking';

const pad = (n: number) => (n < 10 ? '0' : '') + n;

/** Month grid of bookable dates; full dates are tagged "Full", closed ones greyed out. */
export function Calendar({ av, value, monthOffset, onMonth, onPick }: {
  av: Availability;
  value: string | null;
  monthOffset: number;
  onMonth: (offset: number) => void;
  onPick: (iso: string, full: boolean) => void;
}) {
  const [ty, tm] = av.today.split('-').map(Number);
  const first = new Date(Date.UTC(ty, tm - 1 + monthOffset, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const last = addDays(av.today, BOOKING.windowDays).split('-').map(Number);
  const maxOffset = (last[0] - ty) * 12 + (last[1] - tm);
  const monthLabel = `${MONTH_NAMES[m]} ${y}`;
  const lead = weekday(`${y}-${pad(m + 1)}-01`);

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button type="button" className="btn btn-secondary btn-sm" aria-label="Previous month" onClick={() => onMonth(Math.max(0, monthOffset - 1))} disabled={monthOffset <= 0} style={{ width: 44, padding: 0 }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span aria-live="polite" style={{ fontWeight: 600 }}>{monthLabel}</span>
        <button type="button" className="btn btn-secondary btn-sm" aria-label="Next month" onClick={() => onMonth(Math.min(maxOffset, monthOffset + 1))} disabled={monthOffset >= maxOffset} style={{ width: 44, padding: 0 }}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
      <div className="cal" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="dow">{d}</span>)}
      </div>
      <div className="cal" role="group" aria-label={monthLabel}>
        {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} aria-hidden="true" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const iso = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
          const ok = isBookableDate(iso, av.today) && !isClosedDate(av, iso);
          const full = ok && isFullDate(av, iso);
          return (
            <button
              key={iso}
              type="button"
              className={full ? 'day day-full' : 'day'}
              aria-pressed={value === iso}
              aria-label={fmtLong(iso) + (full ? ', fully booked' : '') + (!ok ? ', unavailable' : '')}
              disabled={!ok}
              onClick={() => onPick(iso, full)}
            >
              <span>{i + 1}</span>
              {full && <span className="tag" aria-hidden="true">Full</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
