// Customer-facing message copy: text-message consent wording, every text and email
// (design/Messages.dc.html), and owner/pro alerts. Values arrive already formatted
// ("Tue, Oct 27", "8–11 AM", "$165", "Visa 4242"); lib/notify.ts fills them in and sends.
// Consent wording is saved with each consent in `sms_consent`, so bump the version
// whenever the wording changes.

import { AUTOMATIONS, BRAND, OFFER, PET_WASTE_PRICING, POLICIES } from './config';

export const CONSENT = {
  // Booking Step 3 (both services). The page adds links to the Privacy Policy and Terms after it.
  booking: {
    version: 'booking-2026-10-21',
    text: 'By giving your mobile number, you agree to get booking texts from Fernhouse — confirmations, reminders and visit updates. Message frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.',
  },
  // Separate, unchecked box — marketing only with this opt-in.
  marketing: {
    version: 'marketing-2026-10-21',
    text: 'Also text me offers, up to 2 a month',
  },
  quote: {
    version: 'quote-2026-10-21',
    text: 'By tapping Text me a quote, you agree to get texts from Fernhouse about your quote. Msg & data rates may apply. Reply STOP to opt out, HELP for help.',
  },
  waitlist: {
    version: 'waitlist-2026-10-21',
    text: 'We’ll send one text when we reach your area. Msg & data rates may apply. Reply STOP to opt out.',
  },
} as const;

// ───────── Texts ─────────
// Every customer and pro text starts with "Fernhouse:" and links only to our own domain
// (no link shorteners). The first text to a new number carries HELP/STOP.
// Never ask customers to reply CANCEL or STOP to mean anything else — carriers treat them as opt-outs.

const HELP_STOP = 'Reply HELP for help, STOP to opt out.';

export const TEXTS = {
  // Home cleaning
  bookingConfirmed: (v: { service: string; when: string; street: string; link: string }) =>
    `Fernhouse: You’re booked! ${v.service} ${v.when} at ${v.street}. Manage anytime: ${v.link}\n${HELP_STOP}`,
  teamConfirmed: (v: { when: string; freeUntil: string; link: string }) =>
    `Fernhouse: Your team is confirmed for ${v.when}. Free changes until ${v.freeUntil}: ${v.link}`,
  eveningBefore: (v: { window: string }) =>
    `Fernhouse: Reminder — your clean is tomorrow, ${v.window}. Please secure pets and have access ready. Questions? Just reply.`,
  onTheWay: (v: { eta: string }) => `Fernhouse: Your team is on the way and should arrive by ${v.eta}.`,
  visitDone: (v: { amount: string; card: string; until: string; link: string }) =>
    `Fernhouse: Your clean is done. ${v.amount} was charged to ${v.card}. Something not right? Tell us by ${v.until} for a free re-clean: ${v.link}`,
  // "We’ve texted you a confirmation" after a reschedule on the manage page.
  visitMoved: (v: { when: string; fee?: { amount: string; card: string }; freeUntil: string; link: string }) =>
    `Fernhouse: Your visit moved to ${v.when}.${v.fee ? ` A ${v.fee.amount} late fee was charged to ${v.fee.card}.` : ''} Free changes until ${v.freeUntil}: ${v.link}`,
  // Late cancellation; free cancellations get the same text without the fee line.
  cancelled: (v: { date: string; fee?: { amount: string; card: string }; refund?: { amount: string; card: string }; next?: string }) =>
    `Fernhouse: Your ${v.date} visit is cancelled.` +
    (v.fee ? ` A ${v.fee.amount} late fee was charged to ${v.fee.card}.` : '') +
    (v.refund ? ` We’ve refunded ${v.refund.amount} to ${v.refund.card}.` : '') +
    (v.next ? ` Your plan continues ${v.next}.` : ''),

  // Pet waste removal
  yardBooked: (v: { plan: string; first: string; once: boolean; link: string }) =>
    v.once
      ? `Fernhouse: Yard service booked! ${v.plan}, ${v.first}. We’ll text a gate photo after the visit. Manage: ${v.link}\n${HELP_STOP}`
      : `Fernhouse: Yard service booked! ${v.plan}, first visit ${v.first}. We’ll text a gate photo after every visit. Manage: ${v.link}\n${HELP_STOP}`,
  yardDone: (v: { amount: string; card: string; until: string }) =>
    `Fernhouse: Yard scooped and gate latched (photo above). ${v.amount} charged to ${v.card}. Missed a spot? Reply by ${v.until} and we’ll come back free.`,
  cleanupUpgrade: (v: { booked: string; price: string; was: string }) =>
    `Fernhouse: Your yard needed more than “${v.booked},” so today’s cleanup is ${v.price} instead of ${v.was}. Reply YES to go ahead, or NO to skip this visit with no fee.`,
  weatherMove: (v: { date: string }) => `Fernhouse: Storms today — your yard visit moves to ${v.date}. No action needed.`,
  noAccess: (v: { reason: string }) =>
    `Fernhouse: We couldn’t get into your yard today (${v.reason}). Reply with access info and we’ll come back tomorrow.`,

  // Account, quotes and keyword replies
  manageLink: (url: string) => `Fernhouse: Here’s your link to manage your booking: ${url} It expires in 7 days.`,
  quoteReceived: () =>
    `Fernhouse: Thanks — we got your quote request. We’ll text your price within ${AUTOMATIONS.quoteReplyBusinessHours} business hours. Reply STOP to opt out.`,
  paymentFailed: (v: { card: string; date: string; link: string }) =>
    `Fernhouse: We couldn’t charge ${v.card} for your ${v.date} visit. Please update your card within ${AUTOMATIONS.cardUpdateDeadlineHours} hours to keep your plan: ${v.link}`,
  // The one reminder, 24 hours later (build step 8).
  paymentFailedReminder: (v: { card: string; date: string; deadline: string; link: string }) =>
    `Fernhouse: Reminder — we still couldn’t charge ${v.card} for your ${v.date} visit. Please update your card by ${v.deadline} to keep your plan: ${v.link}`,
  stop: () => 'Fernhouse: You’re unsubscribed and won’t get more texts. Reply START to resubscribe.',
  help: () =>
    `Fernhouse: For help with your booking call ${BRAND.phone} or email ${BRAND.email}. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out.`,
  start: () => 'Fernhouse: You’re resubscribed to booking texts. Reply STOP to opt out.',
  // Marketing: only to customers who ticked the optional offers box; at most 2 a month.
  offerYard: (v: { link: string }) =>
    `Fernhouse: Add weekly yard service to your home clean — from $${PET_WASTE_PRICING.weekly1Dog}/visit, no contracts: ${v.link} Reply STOP to opt out.`,

  // To the owner (own mobile)
  ownerNewBooking: (v: { ref: string; summary: string; when: string; area: string; price: string; link: string }) =>
    `New booking ${v.ref}: ${v.summary}, ${v.when}, ${v.area}, ${v.price}. Assign a pro: ${v.link}`,
  ownerUnassigned: (v: { count: number; next: string; link: string }) =>
    `Reminder: ${v.count} booking${v.count === 1 ? '' : 's'} still need${v.count === 1 ? 's' : ''} a pro. The next is ${v.next}. ${v.link}`,
  ownerCardDeclined: (v: { name: string; amount: string; what: string; texted: boolean; link: string }) =>
    `Card declined: ${v.name}, ${v.amount} for the ${v.what}.${v.texted ? ' Customer has been texted.' : ' Customer could not be texted.'} ${v.link}`,
  ownerNoAccess: (v: { name: string; date: string; reason: string; link: string }) =>
    `No access: ${v.name}, ${v.date} (${v.reason}). Customer has been texted. ${v.link}`,
  ownerRedo: (v: { kind: 're-clean' | 're-scoop'; name: string; what: string; note: string; link: string }) =>
    `${v.kind === 're-clean' ? 'Re-clean' : 'Re-scoop'} request: ${v.name}, ${v.what}${v.note ? ` — “${v.note}”` : ''}. ${v.link}`,
  ownerQuote: (v: { dogs: number; overHalfAcre: boolean; phone: string; link: string }) =>
    `Quote request: ${v.dogs} dog${v.dogs === 1 ? '' : 's'}${v.overHalfAcre ? ', yard over ½ acre' : ''}. Text a price to ${v.phone}. ${v.link}`,

  // To pros — only what they need for one visit
  proJobAssigned: (v: { service: string; date: string; window: string; city: string; link: string }) =>
    `Fernhouse: New job — ${v.service}, ${v.date}, arrive ${v.window}, ${v.city}. Details: ${v.link} ${HELP_STOP}`,
  proDayOf: (v: { service: string; window: string; street: string; city: string; link: string }) =>
    `Fernhouse: Today — ${v.service}, ${v.window}, ${v.street}, ${v.city}. Access and notes: ${v.link}`,
  proDayOfRoute: (v: { count: number; first: string; link: string }) =>
    `Fernhouse: Today — ${v.count} yard${v.count === 1 ? '' : 's'}, starting ${v.first}. Gate codes and notes: ${v.link}`,
  docExpiring: (v: { pro: string; doc: string; date: string; link: string }) =>
    `Fernhouse: ${v.pro}’s ${v.doc} expires ${v.date}. Upload a new one to keep getting jobs: ${v.link}`,
} as const;

export type TextTemplate = keyof typeof TEXTS;

// Inbound keywords (carrier rules). YES only re-subscribes a number that has opted out —
// otherwise it answers a "Reply YES" question (cleanup upgrade).
export const KEYWORDS = {
  stop: ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE', 'OPTOUT'],
  help: ['HELP', 'INFO'],
  start: ['START', 'UNSTOP'],
  startIfOptedOut: ['YES'],
} as const;

// ───────── Emails ─────────
// Laid out by lib/email-html.ts to match the design: brand line, heading, intro, detail rows,
// optional callout, one button, fine print, footer.

export interface EmailContent {
  subject: string;
  preview: string;
  heading: string;
  intro?: string;
  rows?: { label: string; value: string; strong?: boolean }[];
  callout?: { before: string; strong?: string; after?: string };
  button?: { label: string; url: string };
  note?: string;
  footer: string;
  /** Show Privacy · Terms links after the footer. */
  legalLinks?: boolean;
}

const FOOTER = `${BRAND.name} · ${BRAND.region} · ${BRAND.phone}`;
const CHANGE_NOTE = `Free changes until ${POLICIES.freeChangeHours} hours before your visit; $${POLICIES.lateCancelFee} after that. ${POLICIES.guaranteeHours}-hour re-clean guarantee. You pay Fernhouse, never anyone directly.`;

export const EMAILS = {
  bookingConfirmed: (v: {
    firstName: string; when: string; whenShort: string; service: string; serviceShort: string; street: string;
    plan: string; firstLabel?: string; first?: string; address: string; link: string;
  }): EmailContent => ({
    subject: `You’re booked — ${v.whenShort}`,
    preview: `${v.serviceShort} at ${v.street}. Manage or reschedule anytime.`,
    heading: `You’re booked, ${v.firstName}.`,
    intro: 'We’ll text you when your team is confirmed, and again the evening before.',
    rows: [
      { label: 'When', value: v.when },
      { label: 'Service', value: v.service },
      { label: 'Plan', value: v.plan },
      ...(v.firstLabel && v.first ? [{ label: v.firstLabel, value: v.first }] : []),
      { label: 'Address', value: v.address },
    ],
    button: { label: 'Manage booking', url: v.link },
    note: CHANGE_NOTE,
    footer: FOOTER,
    legalLinks: true,
  }),

  yardBooked: (v: {
    firstName: string; subjectPlan: string; firstShort: string; plan: string; dogs: string; first: string;
    firstPrice: string; perVisit: string; address: string; once: boolean; link: string;
  }): EmailContent => ({
    subject: v.once ? `Yard cleanup booked — ${v.firstShort}` : `Yard service booked — ${v.subjectPlan}, starting ${v.firstShort}`,
    preview: `${v.plan} at ${v.address.split(',')[0]}. Nothing is charged until after each visit.`,
    heading: `Your yard is booked, ${v.firstName}.`,
    intro: `We’ll text a gate photo after every visit, so you know the gate is latched. Missed a spot? Tell us within ${POLICIES.guaranteeWindow} and we’ll come back to re-scoop, free.`,
    rows: [
      { label: 'Route day', value: v.plan },
      { label: 'Dogs', value: v.dogs },
      { label: 'First visit', value: v.first },
      { label: v.once ? 'Cleanup' : 'First visit price', value: v.firstPrice },
      ...(v.once ? [] : [{ label: 'After that', value: v.perVisit }]),
      { label: 'Address', value: v.address },
    ],
    button: { label: 'Manage booking', url: v.link },
    note: `Your card is charged after each visit, never before. Change your route day free until ${POLICIES.petChangeCutoffHour - 12} PM the night before. You pay Fernhouse, never anyone directly.`,
    footer: FOOTER,
    legalLinks: true,
  }),

  receipt: (v: {
    isPet: boolean; dateShort: string; amount: string; amountExact: string; card: string; cardShort: string; line: string;
    tax: string; total: string; until: string; receiptNo: string; link: string;
  }): EmailContent => ({
    subject: `Receipt — your ${v.dateShort} ${v.isPet ? 'yard visit' : 'clean'}, ${v.amount}`,
    preview: `Paid with ${v.cardShort}. Not happy with something? Tell us within ${POLICIES.guaranteeWindow}.`,
    heading: 'Thanks — here’s your receipt.',
    rows: [
      { label: v.line, value: v.amountExact },
      { label: 'Tax', value: v.tax },
      { label: `Total paid · ${v.card}`, value: v.total, strong: true },
    ],
    callout: v.isPet
      ? { before: 'Missed a spot? Tell us by ', strong: v.until, after: ' and we’ll come back to re-scoop, free.' }
      : { before: 'Something not right? Tell us by ', strong: v.until, after: ' and we’ll send a team back to re-clean, free.' },
    button: { label: v.isPet ? 'Request a re-scoop' : 'Request a re-clean', url: v.link },
    footer: `Receipt ${v.receiptNo} · ${FOOTER}`,
  }),

  visitMoved: (v: { when: string; was: string; fee?: string; freeUntil: string; link: string }): EmailContent => ({
    subject: `Your visit moved to ${v.when}`,
    preview: 'The rest of your plan is unchanged.',
    heading: `Your visit moved to ${v.when}.`,
    intro: 'The rest of your plan is unchanged.',
    rows: [
      { label: 'Was', value: v.was },
      { label: 'Now', value: v.when },
      ...(v.fee ? [{ label: 'Late fee', value: v.fee }] : []),
      { label: 'Free changes until', value: v.freeUntil },
    ],
    button: { label: 'Manage booking', url: v.link },
    note: CHANGE_NOTE,
    footer: FOOTER,
    legalLinks: true,
  }),

  visitSkipped: (v: { what: string; date: string; when: string; next?: string; isPet: boolean; link: string }): EmailContent => ({
    subject: `Your ${v.date} ${v.what} is skipped`,
    preview: v.next ? `Your next visit is ${v.next}.` : 'The rest of your plan is unchanged.',
    heading: `Your ${v.date} ${v.what} is skipped.`,
    intro: 'The rest of your plan is unchanged.',
    rows: [{ label: 'Skipped', value: v.when }, ...(v.next ? [{ label: 'Next visit', value: v.next }] : [])],
    button: { label: 'Manage booking', url: v.link },
    note: v.isPet
      ? `Changed your mind? Bring it back from your manage link until ${POLICIES.petChangeCutoffHour - 12} PM the night before.`
      : 'Changed your mind? Bring it back from your manage link before the visit starts.',
    footer: FOOTER,
    legalLinks: true,
  }),

  visitRestored: (v: { what: string; date: string; when: string; link: string }): EmailContent => ({
    subject: `Your ${v.date} ${v.what} is back on`,
    preview: 'The rest of your plan is unchanged.',
    heading: `Your ${v.date} ${v.what} is back on.`,
    intro: 'We’ll see you then. The rest of your plan is unchanged.',
    rows: [{ label: 'Visit', value: v.when }],
    button: { label: 'Manage booking', url: v.link },
    footer: FOOTER,
    legalLinks: true,
  }),

  planResumed: (v: { plan: string; next?: string; link: string }): EmailContent => ({
    subject: 'Your plan is back on',
    preview: v.next ? `Your next visit is ${v.next}.` : `Your ${v.plan} has resumed.`,
    heading: 'Your plan is back on.',
    intro: `Your ${v.plan} has resumed.`,
    rows: v.next ? [{ label: 'Next visit', value: v.next }] : [],
    button: { label: 'Manage booking', url: v.link },
    note: 'Pause again anytime from your manage link — there’s no fee.',
    footer: FOOTER,
    legalLinks: true,
  }),

  routeDayChanged: (v: { day: string; plan: string; first?: string; link: string }): EmailContent => ({
    subject: `Your yard day is now ${v.day}`,
    preview: 'Your price and the rest of your plan stay the same.',
    heading: `Your yard day is now ${v.day}.`,
    intro: 'Your price and the rest of your plan stay the same.',
    rows: [{ label: 'Route day', value: v.plan }, ...(v.first ? [{ label: 'First visit', value: v.first }] : [])],
    button: { label: 'Manage booking', url: v.link },
    note: `Change your route day free until ${POLICIES.petChangeCutoffHour - 12} PM the night before a visit.`,
    footer: FOOTER,
    legalLinks: true,
  }),

  cancelled: (v: { date: string; fee?: string; card: string; refund?: string; next?: string; rebook: string }): EmailContent => ({
    subject: `Your ${v.date} visit is cancelled`,
    preview: v.fee ? `A ${v.fee} late fee applied.` : 'There’s no fee.',
    heading: `Your ${v.date} visit is cancelled.`,
    intro: v.next ? `The rest of your plan is unchanged. Your next visit is ${v.next}.` : 'There are no more visits on this booking.',
    rows: [
      { label: 'Late fee', value: v.fee ? `${v.fee} · ${v.card}` : 'None' },
      ...(v.refund ? [{ label: 'Refund', value: `${v.refund} to ${v.card}` }] : []),
      { label: 'Next visit', value: v.next ?? 'None — your plan has ended' },
    ],
    button: { label: 'Book again', url: v.rebook },
    note: v.refund ? 'Refunds usually reach your card in 5–10 business days.' : CHANGE_NOTE,
    footer: FOOTER,
    legalLinks: true,
  }),

  cardDeclined: (v: { card: string; date: string; amount: string; deadline: string; link: string }): EmailContent => ({
    subject: 'Action needed: update your card',
    preview: `We couldn’t charge ${v.card} for your ${v.date} visit.`,
    heading: 'We couldn’t charge your card.',
    intro: `Your bank declined ${v.amount} for your ${v.date} visit. Please add a new card by ${v.deadline} to keep your plan — after that it pauses.`,
    rows: [
      { label: 'Visit', value: v.date },
      { label: 'Amount', value: v.amount },
      { label: 'Card', value: v.card },
    ],
    button: { label: 'Update card', url: v.link },
    note: 'Your card details go straight to our payment processor; we never see or store the full number.',
    footer: FOOTER,
    legalLinks: true,
  }),

  planPaused: (v: { plan: string; link: string }): EmailContent => ({
    subject: 'Your plan is paused',
    preview: 'No visits until you resume — anytime, from your manage link.',
    heading: 'Your plan is paused.',
    intro: `No visits are scheduled for your ${v.plan} until you resume. There’s no fee to pause or resume.`,
    button: { label: 'Resume plan', url: v.link },
    note: 'Access notes and gate codes are deleted when service ends, as our Privacy Policy describes.',
    footer: FOOTER,
    legalLinks: true,
  }),

  planEnded: (v: { plan: string; kept?: string; rebook: string }): EmailContent => ({
    subject: 'Your plan has ended',
    preview: v.kept ? `Your ${v.kept} visit stays booked.` : 'No more visits are scheduled.',
    heading: 'Your plan has ended.',
    intro: v.kept
      ? `Your ${v.plan} is cancelled. Your visit on ${v.kept} is less than ${POLICIES.freeChangeHours} hours away and stays booked — you can still cancel it from your manage link.`
      : `Your ${v.plan} is cancelled and no more visits are scheduled. Thanks for having us.`,
    button: { label: 'Book again', url: v.rebook },
    note: 'Access notes and gate codes are deleted when service ends, as our Privacy Policy describes.',
    footer: FOOTER,
    legalLinks: true,
  }),

  // Day after the first visit (build step 8). Private — never published as a review.
  rating: (v: { firstName: string; isPet: boolean; link: string }): EmailContent => ({
    subject: v.isPet ? 'How did your first yard visit go?' : 'How did your first clean go?',
    preview: 'One question, 1 to 5. Only we see your answer.',
    heading: `How did we do, ${v.firstName}?`,
    intro: 'On a scale of 1 to 5, how was your first visit? Your answer goes only to us, so we can fix anything that wasn’t right.',
    button: { label: v.isPet ? 'Rate your visit' : 'Rate your clean', url: v.link },
    footer: FOOTER,
    legalLinks: true,
  }),

  // To the owner
  ownerNewBooking: (v: { ref: string; summary: string; whenShort: string; rows: { label: string; value: string }[]; link: string }): EmailContent => ({
    subject: `New booking ${v.ref} — ${v.summary}, ${v.whenShort}`,
    preview: 'Assign a pro from the dashboard.',
    heading: `New booking ${v.ref}`,
    intro: 'It’s waiting on the dashboard until you assign a pro.',
    rows: v.rows,
    button: { label: 'Assign a pro', url: v.link },
    note: 'Access notes and gate codes are on the dashboard, not in email.',
    footer: FOOTER,
  }),

  ownerInbound: (v: { from: string; who: string; body: string; link: string }): EmailContent => ({
    subject: `Text from ${v.who}`,
    preview: v.body.slice(0, 90),
    heading: `Text from ${v.who}`,
    rows: [{ label: 'From', value: v.from }, { label: 'Message', value: v.body }],
    button: { label: 'Open dashboard', url: v.link },
    note: `Reply by text from ${BRAND.phone} — replying to this email doesn’t reach the customer.`,
    footer: FOOTER,
  }),
} as const;

export const QUOTE = {
  sent: (phone: string) => `Thanks — we’ll text ${phone} with your quote.`,
  intro: 'Leave your mobile number and we’ll text you a quote today — no payment needed.',
  titleDogs: '5 or more dogs? Let’s quote your yard.',
  titleYard: 'Yard over ½ acre? Let’s quote it.',
} as const;

// The 20% first-clean offer is named only where the booking is (OFFER.firstCleanPct).
export const FIRST_CLEAN_ROW = `First clean (${OFFER.firstCleanPct}% off)`;

// How a visit is named inside messages ("your Oct 27 yard visit is skipped").
export const VISIT_WORD = { pet: 'yard visit', clean: 'visit' } as const;
export const PLAN_NAME = (isPet: boolean, freq: string) => (isPet ? `${freq.toLowerCase()} yard service` : `${freq.toLowerCase()} clean`);
