import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';

describe('calendar files', () => {
  it('builds a timed cleaning visit in Atlanta time', () => {
    const ics = buildIcs({ uid: 'FH-26-04817', title: 'Fernhouse clean', description: 'Arrival 8–11 am', location: '482 Maple Ridge Dr, Marietta, GA 30062', date: '2026-10-27', startHour: 8, endHour: 11, weeklyEvery: 2 }, new Date('2026-10-23T00:00:00Z'));
    expect(ics).toContain('DTSTART;TZID=America/New_York:20261027T080000');
    expect(ics).toContain('DTEND;TZID=America/New_York:20261027T110000');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2');
    expect(ics).toContain('LOCATION:482 Maple Ridge Dr\\, Marietta\\, GA 30062');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });

  it('builds an all-day weekly route day', () => {
    const ics = buildIcs({ uid: 'FH-26-05132', title: 'Fernhouse yard visit', description: '', location: 'x', date: '2026-10-27', weeklyEvery: 1 });
    expect(ics).toContain('DTSTART;VALUE=DATE:20261027');
    expect(ics).toContain('DTEND;VALUE=DATE:20261028');
  });
});
