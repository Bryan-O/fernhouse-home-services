// "Add to calendar" files (.ics). Times are Atlanta wall-clock times.

import { BRAND, TIMEZONE } from './config';
import { addDays } from './booking';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const compact = (iso: string) => iso.replace(/-/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

export interface IcsEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  date: string; // YYYY-MM-DD
  startHour?: number; // timed event (cleaning window); omitted → all-day (yard route day)
  endHour?: number;
  weeklyEvery?: 1 | 2; // repeat weekly or every other week
}

export function buildIcs(e: IcsEvent, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const when = e.startHour !== undefined
    ? [`DTSTART;TZID=${TIMEZONE}:${compact(e.date)}T${pad(e.startHour)}0000`, `DTEND;TZID=${TIMEZONE}:${compact(e.date)}T${pad(e.endHour ?? e.startHour + 3)}0000`]
    : [`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`];
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${BRAND.name}//Booking//EN`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e.uid}@${BRAND.domain}`,
    `DTSTAMP:${stamp}`,
    ...when,
    ...(e.weeklyEvery ? [`RRULE:FREQ=WEEKLY;INTERVAL=${e.weeklyEvery}`] : []),
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.description)}`,
    `LOCATION:${esc(e.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
