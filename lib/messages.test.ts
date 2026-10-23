import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { EMAILS, FIRST_CLEAN_ROW, KEYWORDS, TEXTS } from './messages';
import { keywordOf } from './keywords';
import { renderEmail } from './email-html';
import {
  adminBookingPath, cardEmail, cardText, dayDate, displayUrl, freeUntil, money, monthDay, ownerWhen, shortName,
  untilText, visitWhen, yardPlanText,
} from './format';
import { atlantaTime } from './policy';

// The sample texts drawn in design/Messages.dc.html, read straight from the design file.
const src = readFileSync('design/Messages.dc.html', 'utf8');
const script = src.slice(src.indexOf('var L ='), src.indexOf('class Component'));
const design = runInNewContext(`${script}; ({ CLEAN, PET, ACCT, OPS, EMAILS, REG })`) as Record<string, { name?: string; body: string; subject?: string }[]>;
const body = (list: string, name: string) => design[list].find((t) => t.name === name)!.body;

const L = 'fernhouseclean.com/b/x7Kq2';
const TUE = '2026-10-27';
const visa = cardText('visa', '4242');

describe('texts match the design word for word', () => {
  it('home cleaning', () => {
    expect(TEXTS.bookingConfirmed({ service: 'Standard clean', when: visitWhen(TUE, 'morning'), street: '482 Maple Ridge Dr', link: L })).toBe(body('CLEAN', 'Booking confirmed'));
    expect(TEXTS.teamConfirmed({ when: visitWhen(TUE, 'morning'), freeUntil: freeUntil(TUE, 'morning'), link: L })).toBe(body('CLEAN', 'Team confirmed'));
    expect(TEXTS.eveningBefore({ window: '8–11 AM' })).toBe(body('CLEAN', 'Evening-before reminder'));
    expect(TEXTS.onTheWay({ eta: '9:40 AM' })).toBe(body('CLEAN', 'On the way'));
    expect(TEXTS.visitDone({ amount: money(16500), card: visa, until: '11 AM tomorrow', link: L })).toBe(body('CLEAN', 'Visit done + charge'));
    expect(TEXTS.cancelled({ date: monthDay(TUE), fee: { amount: money(5000), card: visa }, next: dayDate('2026-11-10') })).toBe(body('CLEAN', 'Late cancellation'));
  });

  it('pet waste removal', () => {
    expect(TEXTS.yardBooked({ plan: yardPlanText('weekly', 'tue'), first: monthDay(TUE), once: false, link: L })).toBe(body('PET', 'Yard service booked'));
    expect(TEXTS.yardDone({ amount: money(2700), card: visa, until: '11:42 AM tomorrow' })).toBe(body('PET', 'Visit done + gate photo'));
    expect(TEXTS.cleanupUpgrade({ booked: 'a few weeks behind', price: '$75', was: '$39' })).toBe(body('PET', 'Cleanup upgrade'));
    expect(TEXTS.weatherMove({ date: dayDate('2026-10-28') })).toBe(body('PET', 'Weather move'));
    expect(TEXTS.noAccess({ reason: 'gate locked' })).toBe(body('PET', 'Couldn’t get in'));
  });

  it('account, quotes and keyword replies', () => {
    expect(TEXTS.manageLink(L)).toBe(body('ACCT', 'Manage-booking link'));
    expect(TEXTS.quoteReceived()).toBe(body('ACCT', 'Quote request received'));
    expect(TEXTS.paymentFailed({ card: visa, date: monthDay(TUE), link: L })).toBe(body('ACCT', 'Payment failed'));
    expect(TEXTS.stop()).toBe(body('ACCT', 'STOP'));
    expect(TEXTS.help()).toBe(body('ACCT', 'HELP'));
    expect(TEXTS.start()).toBe(body('ACCT', 'START'));
    expect(TEXTS.offerYard({ link: 'fernhouseclean.com/pet-waste-removal' })).toBe(body('ACCT', 'Offer (opted-in only)'));
  });

  it('to the owner and pros', () => {
    expect(TEXTS.ownerNewBooking({
      ref: 'FH-26-04817', summary: 'Standard clean 3bd/2ba', when: ownerWhen(TUE, 'morning'), area: 'Marietta 30062',
      price: `${money(13200)} (first clean)`, link: `fernhouseclean.com${adminBookingPath('FH-26-04817')}`,
    })).toBe(body('OPS', 'New booking'));
    expect(TEXTS.ownerUnassigned({ count: 2, next: `${ownerWhen(TUE, 'morning')} in Marietta`, link: 'fernhouseclean.com/admin' })).toBe(body('OPS', 'Still unassigned'));
    expect(TEXTS.ownerCardDeclined({ name: shortName('Taylor Morgan'), amount: '$165', what: 'Oct 20 clean', texted: true, link: 'fernhouseclean.com/admin' })).toBe(body('OPS', 'Problem alert'));
    expect(TEXTS.proJobAssigned({ service: 'Standard clean', date: 'Tue Oct 27', window: '8–11 AM', city: 'Marietta', link: 'fernhouseclean.com/job/k3Pz9' })).toBe(body('OPS', 'Job assigned'));
    expect(TEXTS.proDayOf({ service: 'Standard clean', window: '8–11 AM', street: '482 Maple Ridge Dr', city: 'Marietta', link: 'fernhouseclean.com/job/k3Pz9' })).toBe(body('OPS', 'Day-of reminder'));
    expect(TEXTS.docExpiring({ pro: 'Andre W.', doc: 'insurance certificate', date: 'Nov 14', link: 'fernhouseclean.com/job/docs' })).toBe(body('OPS', 'Document expiring'));
  });

  it('keywords match the registration answers', () => {
    const reg = (k: string) => design.REG.find((r) => (r as unknown as { k: string }).k === k) as unknown as { v: string };
    for (const w of ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']) expect(KEYWORDS.stop).toContain(w);
    for (const w of ['HELP', 'INFO']) expect(KEYWORDS.help).toContain(w);
    expect(reg('Opt-out keywords & reply').v).toContain(TEXTS.stop());
    expect(reg('Help keywords & reply').v).toContain(TEXTS.help());
  });
});

describe('every text', () => {
  const samples: Record<string, string> = {
    free: TEXTS.cancelled({ date: 'Oct 27', next: 'Tue, Nov 10' }),
    refund: TEXTS.cancelled({ date: 'Oct 27', refund: { amount: '$132', card: visa } }),
    moved: TEXTS.visitMoved({ when: 'Thu, Oct 29, 11 AM–2 PM', freeUntil: 'Wed 11 AM', link: L }),
    once: TEXTS.yardBooked({ plan: 'One-time cleanup', first: 'Tue, Oct 27', once: true, link: L }),
    reminder: TEXTS.paymentFailedReminder({ card: visa, date: 'Oct 27', deadline: 'Thu 3 PM', link: L }),
    route: TEXTS.proDayOfRoute({ count: 9, first: '8 AM in Decatur', link: L }),
  };
  it('to customers and pros starts with "Fernhouse:" and never asks for STOP or CANCEL as a reply word', () => {
    for (const [name, t] of Object.entries(samples)) {
      expect(t, name).toMatch(/^Fernhouse: /);
      expect(t, name).not.toMatch(/Reply (CANCEL|STOP) to (?!opt out)/);
    }
    expect(samples.free).toBe('Fernhouse: Your Oct 27 visit is cancelled. Your plan continues Tue, Nov 10.');
    expect(samples.once).toMatch(/^Fernhouse: Yard service booked! One-time cleanup, Tue, Oct 27\. We’ll text a gate photo after the visit\./);
  });

  it('uses none of the banned words', () => {
    const all = JSON.stringify([TEXTS, EMAILS].map((o) => Object.values(o).map((f) => String(f)))) + Object.values(samples).join(' ');
    expect(all).not.toMatch(/subcontractor|partner|marketplace/i);
  });
});

describe('keywords', () => {
  it('reads the whole message, any case, ignoring punctuation', () => {
    expect(keywordOf('stop', false)).toBe('stop');
    expect(keywordOf(' Stop. ', false)).toBe('stop');
    expect(keywordOf('Unsubscribe', false)).toBe('stop');
    expect(keywordOf('help', false)).toBe('help');
    expect(keywordOf('Start', true)).toBe('start');
    expect(keywordOf('please stop by the shed', false)).toBe(null);
  });
  it('YES only re-subscribes a number that opted out (otherwise it answers a question)', () => {
    expect(keywordOf('Yes', true)).toBe('start');
    expect(keywordOf('Yes', false)).toBe(null);
  });
});

describe('formatting', () => {
  it('reads like the design', () => {
    expect(money(16500)).toBe('$165');
    expect(money(2750)).toBe('$27.50');
    expect(cardText('visa', '4242')).toBe('Visa 4242');
    expect(cardText('amex', '0005')).toBe('Amex 0005');
    expect(cardText(null, null)).toBe('your card');
    expect(cardEmail('visa', '4242')).toBe('Visa •••• 4242');
    expect(visitWhen(TUE, 'midday')).toBe('Tue, Oct 27, 11 AM–2 PM');
    expect(freeUntil(TUE, null)).toBe('Mon 8 PM');
    expect(shortName('Taylor Ann Morgan')).toBe('Taylor M.');
    expect(shortName('Cher')).toBe('Cher');
    expect(yardPlanText('twice_weekly', 'tue')).toBe('Twice a week, Tuesdays and Fridays');
    expect(yardPlanText('biweekly', 'mon')).toBe('Every other Monday');
  });
  it('guarantee deadlines read as "11 AM tomorrow"', () => {
    const now = atlantaTime(TUE, 15);
    expect(untilText(atlantaTime('2026-10-28', 11), now)).toBe('11 AM tomorrow');
    expect(untilText(atlantaTime('2026-10-28', 11, 42), now)).toBe('11:42 AM tomorrow');
    expect(untilText(atlantaTime(TUE, 18), now)).toBe('6 PM today');
    expect(untilText(atlantaTime('2026-10-29', 9), now)).toBe('Thu 9 AM');
  });
  it('drops https:// only on our own domain', () => {
    expect(displayUrl('https://fernhouseclean.com/b/abc')).toBe('fernhouseclean.com/b/abc');
    expect(displayUrl('http://localhost:3000/b/abc')).toBe('http://localhost:3000/b/abc');
  });
});

describe('emails', () => {
  const booked = EMAILS.bookingConfirmed({
    firstName: 'Jordan', when: 'Tue, Oct 27 · 8–11 AM arrival', whenShort: visitWhen(TUE, 'morning'), service: 'Standard clean · 3 bed, 2 bath',
    serviceShort: 'Standard clean', street: '482 Maple Ridge Dr', plan: 'Biweekly · $165 per visit', firstLabel: FIRST_CLEAN_ROW, first: '$132',
    address: '482 Maple Ridge Dr, Marietta, GA 30062', link: 'https://fernhouseclean.com/b/x7Kq2',
  });
  it('booking confirmation matches the design', () => {
    expect(booked.subject).toBe('You’re booked — Tue, Oct 27, 8–11 AM');
    expect(booked.preview).toBe('Standard clean at 482 Maple Ridge Dr. Manage or reschedule anytime.');
    expect(booked.heading).toBe('You’re booked, Jordan.');
    expect(booked.rows!.map((r) => r.label)).toEqual(['When', 'Service', 'Plan', 'First clean (20% off)', 'Address']);
    expect(booked.note).toBe('Free changes until 24 hours before your visit; $50 after that. 24-hour re-clean guarantee. You pay Fernhouse, never anyone directly.');
    expect(booked.footer).toBe('Fernhouse · Atlanta, GA · (678) 439-6213');
  });
  it('receipt matches the design', () => {
    const r = EMAILS.receipt({
      isPet: false, dateShort: 'Oct 27', amount: '$165', amountExact: '$165.00', card: 'Visa •••• 4242', cardShort: 'Visa 4242', line: 'Standard clean · Oct 27',
      tax: '$0.00', total: '$165.00', until: '11 AM tomorrow', receiptNo: 'FH-26-04817-03', link: L,
    });
    expect(r.subject).toBe('Receipt — your Oct 27 clean, $165');
    expect(r.preview).toBe('Paid with Visa 4242. Not happy with something? Tell us within 24 hours.');
    expect(`${r.callout!.before}${r.callout!.strong}${r.callout!.after}`).toBe('Something not right? Tell us by 11 AM tomorrow and we’ll send a team back to re-clean, free.');
    expect(r.footer).toBe('Receipt FH-26-04817-03 · Fernhouse · Atlanta, GA · (678) 439-6213');
  });
  it('subjects match the design list', () => {
    const subjects = design.EMAILS.map((e) => e.subject);
    expect(subjects).toContain(EMAILS.yardBooked({ firstName: 'J', subjectPlan: 'Tuesdays', firstShort: 'Oct 27', plan: '', dogs: '', first: '', firstPrice: '', perVisit: '', address: '', once: false, link: L }).subject);
    expect(subjects).toContain(EMAILS.visitMoved({ when: 'Thu, Oct 29, 11 AM–2 PM', was: '', freeUntil: '', link: L }).subject);
    expect(subjects).toContain(EMAILS.cancelled({ date: 'Oct 27', card: '', rebook: L }).subject);
    expect(subjects).toContain(EMAILS.cardDeclined({ card: '', date: '', amount: '', deadline: '', link: L }).subject);
    expect(subjects).toContain(EMAILS.planPaused({ plan: '', link: L }).subject);
    expect(subjects).toContain(EMAILS.rating({ firstName: 'J', isPet: false, link: L }).subject);
  });
  it('renders escaped HTML and a plain-text copy', () => {
    const { html, text } = renderEmail({ ...booked, heading: 'Hi <Jordan> & co' }, 'https://fernhouseclean.com');
    expect(html).toContain('Hi &lt;Jordan&gt; &amp; co');
    expect(html).toContain('href="https://fernhouseclean.com/b/x7Kq2"');
    expect(html).toContain('href="https://fernhouseclean.com/privacy"');
    expect(text).toContain('Manage booking: https://fernhouseclean.com/b/x7Kq2');
    expect(text).toContain('First clean (20% off): $132');
  });
});
