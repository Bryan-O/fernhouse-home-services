// Fernhouse business settings — the one place prices, policies, ZIP codes and
// schedules live. Pages render from here; never type a price or policy into a page.
// Values are lifted from the design constants (design/*.dc.html) and HANDOFF.md.

// ───────── Brand ─────────

export const BRAND = {
  name: 'Fernhouse',
  phone: '(678) 439-6213',
  phoneHref: 'tel:+16784396213',
  phoneE164: '+16784396213',
  email: 'fernhousehomeservices@gmail.com', // customer replies go here
  // TODO (owner): placeholder until the domain is bought.
  domain: 'fernhouseclean.com',
  sendFrom: 'bookings@fernhouseclean.com', // Resend sender; reply-to is `email`
  region: 'Atlanta, GA',
  areaLine: 'Atlanta and surrounding suburbs',
  copyrightYear: 2026,
} as const;

export const SITE_URL = `https://${BRAND.domain}`;

// Every date and time in the business runs on Atlanta time.
export const TIMEZONE = 'America/New_York';

// ───────── Home cleaning ─────────

export type CleanService = 'standard' | 'deep' | 'move';
export type CleanFrequency = 'oneTime' | 'weekly' | 'biweekly';

export interface HomeSize {
  bd: number;
  ba: number;
  /** Standard clean, biweekly recurring. */
  standard: number;
  deep: number;
  move: number;
  popular?: boolean;
}

// Starting prices per visit, homes in normal condition. Standard = biweekly recurring.
export const PRICING = {
  rows: [
    { bd: 1, ba: 1, standard: 110, deep: 230, move: 250 },
    { bd: 2, ba: 1, standard: 125, deep: 270, move: 290 },
    { bd: 2, ba: 2, standard: 140, deep: 300, move: 325 },
    { bd: 3, ba: 2, standard: 165, deep: 360, move: 390, popular: true },
    { bd: 3, ba: 3, standard: 180, deep: 395, move: 425 },
    { bd: 4, ba: 3, standard: 200, deep: 440, move: 475 },
    { bd: 4, ba: 4, standard: 220, deep: 480, move: 520 },
    { bd: 5, ba: 4, standard: 245, deep: 540, move: 580 },
  ] as readonly HomeSize[],
  // Weekly = 10% below biweekly, one-time Standard = 15% above; rounded to the nearest $5.
  frequencyAdjustments: { weekly: -0.1, biweekly: 0, oneTime: 0.15 } as Record<CleanFrequency, number>,
  roundTo: 5,
  // Above this → "call for a custom quote".
  maxBeds: 5,
  maxBaths: 4,
} as const;

export const DEFAULT_HOME = { bd: 3, ba: 2 } as const;

export const CLEAN_SERVICE_LABEL: Record<CleanService, string> = {
  standard: 'Standard',
  deep: 'Deep clean',
  move: 'Move-In/Out',
};

export const CLEAN_FREQ_LABEL: Record<CleanFrequency, string> = {
  oneTime: 'One-time',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
};

/**
 * The price row for a home, or null when it needs a custom quote.
 * A bed/bath combination not in the table uses the next size up that covers it.
 * TODO (owner): confirm the next-size-up rule.
 */
export function lookupHome(bd: number, ba: number): HomeSize | null {
  if (bd > PRICING.maxBeds || ba > PRICING.maxBaths) return null;
  const exact = PRICING.rows.find((r) => r.bd === bd && r.ba === ba);
  if (exact) return exact;
  return PRICING.rows.find((r) => r.bd >= bd && r.ba >= ba) ?? null;
}

/** Standard-clean price for a frequency, rounded to the nearest $5. */
export function standardFor(row: HomeSize, freq: CleanFrequency): number {
  const raw = row.standard * (1 + PRICING.frequencyAdjustments[freq]);
  return Math.round(raw / PRICING.roundTo) * PRICING.roundTo;
}

/** Per-visit price. Deep and Move-In/Out are always one-time visits. */
export function cleanVisitPrice(row: HomeSize, service: CleanService, freq: CleanFrequency): number {
  return service === 'standard' ? standardFor(row, freq) : row[service];
}

/** The size most customers book, used for "from" anchors (3 bd / 2 ba). */
export function popularHome(): HomeSize {
  return PRICING.rows.find((r) => r.popular) ?? PRICING.rows[0];
}

// ───────── First-clean offer ─────────

// Must match the ads exactly. Shown once per page; once per household.
export const OFFER = { firstCleanPct: 20 } as const;

/** Whole-dollar first-clean discount. No sales tax (Georgia doesn't tax these services). */
export function firstCleanDiscount(price: number): number {
  return Math.round((price * OFFER.firstCleanPct) / 100);
}

export function firstCleanTotal(price: number): number {
  return price - firstCleanDiscount(price);
}

export const SALES_TAX_PCT = 0;

// ───────── Pet waste removal ─────────

export type PetFrequency = 'weekly' | 'twice' | 'biweekly' | 'once';
export type YardCondition = 'kept' | 'weeks' | 'month';

// Per visit, yards up to ½ acre. 5+ dogs or a yard over ½ acre → quote, never a guessed price.
export const PET_WASTE_PRICING = {
  weekly1Dog: 24,
  perExtraDog: 3,
  twiceWeeklyLess: 4, // twice weekly = weekly − $4
  biweeklyAdd: 8, // every other week = weekly + $8
  oneTime: 89, // flat one-time yard reset
  // Initial yard cleanup replaces the first visit's price, set by yard condition:
  // kept up weekly → none · a few weeks behind → $39 with weekly/twice weekly ($75 otherwise) · a month or more → $75
  initialCleanup: 75,
  initialCleanupWithWeekly: 39,
  maxDogs: 4,
  maxYardAcres: 0.5,
  // Never flea, tick or any pesticide treatment.
  addOns: { deodorizer: 12, sanitizing: 29 },
} as const;

export const PET_FREQS: readonly { id: PetFrequency; label: string; popular?: boolean }[] = [
  { id: 'weekly', label: 'Weekly', popular: true },
  { id: 'twice', label: 'Twice weekly' },
  { id: 'biweekly', label: 'Every other week' },
  { id: 'once', label: 'One-time cleanup' },
];

export const PET_FREQ_LABEL: Record<PetFrequency, string> = {
  weekly: 'Weekly',
  twice: 'Twice weekly',
  biweekly: 'Every other week',
  once: 'One-time cleanup',
};

export const YARD_CONDITIONS: readonly { id: YardCondition; label: string; lower: string }[] = [
  { id: 'kept', label: 'Kept up weekly', lower: 'kept up weekly' },
  { id: 'weeks', label: 'A few weeks behind', lower: 'a few weeks behind' },
  { id: 'month', label: 'A month or more', lower: 'a month or more' },
];

export const DEFAULT_PET = { freq: 'weekly' as PetFrequency, dogs: 1, cond: 'weeks' as YardCondition };

/** Per-visit price for a frequency and dog count (1–4). */
export function petVisit(freq: PetFrequency, dogs: number): number {
  const P = PET_WASTE_PRICING;
  const weekly = P.weekly1Dog + P.perExtraDog * (Math.min(Math.max(dogs, 1), P.maxDogs) - 1);
  if (freq === 'once') return P.oneTime;
  if (freq === 'biweekly') return weekly + P.biweeklyAdd;
  if (freq === 'twice') return weekly - P.twiceWeeklyLess;
  return weekly;
}

/** Initial yard cleanup price (0 = none; the first visit is the per-visit price). */
export function petInitial(freq: PetFrequency, cond: YardCondition): number {
  const P = PET_WASTE_PRICING;
  if (freq === 'once' || cond === 'kept') return 0;
  if (cond === 'month' || freq === 'biweekly') return P.initialCleanup;
  return P.initialCleanupWithWeekly;
}

export function needsPetQuote(dogs: number, overHalfAcre: boolean): boolean {
  return dogs > PET_WASTE_PRICING.maxDogs || overHalfAcre;
}

export function dogsText(n: number): string {
  if (n > PET_WASTE_PRICING.maxDogs) return `${PET_WASTE_PRICING.maxDogs + 1}+ dogs`;
  return n === 1 ? '1 dog' : `${n} dogs`;
}

// ───────── Policies ─────────

export const POLICIES = {
  // Free until 24 hours before a visit; after that, the late fee.
  freeChangeHours: 24,
  lateCancelFee: 50,
  // Pet route-day changes are free until 8 PM the night before.
  petChangeCutoffHour: 20,
  // Re-clean (cleaning) or re-scoop (yard) if reported within this window.
  guaranteeHours: 24,
  guaranteeWindow: '24 hours',
  // A no-access visit counts as a late cancellation (Terms).
  noAccessCountsAsLateCancel: true,
} as const;

// Terms and Privacy Policy values. TODO (owner): Georgia attorney review before launch.
export const LEGAL = {
  privacyUpdated: 'October 21, 2026',
  termsUpdated: 'October 21, 2026',
  damageReportHours: 48,
  directHireFee: 1000,
  directHireMonths: 12,
  minAge: 13,
  governingState: 'Georgia',
} as const;

export const CANCELLATION_POLICY =
  `Reschedule or cancel free up to ${POLICIES.freeChangeHours} hours before your visit, right from your confirmation link. ` +
  `Changes inside ${POLICIES.freeChangeHours} hours carry a $${POLICIES.lateCancelFee} late-cancellation fee, because your team has already been scheduled.`;

// When each kind of visit is charged.
export const PAYMENT_TIMING = {
  firstClean: 'at booking', // Stripe Checkout, card saved
  recurringClean: 'morning of each visit', // off-session
  petWaste: 'after each visit', // when the pro marks it done; nothing charged at booking
} as const;

// ───────── Service area ─────────

export const SERVICE_AREAS = [
  'Atlanta', 'Marietta', 'Sandy Springs', 'Roswell', 'Alpharetta',
  'Decatur', 'Brookhaven', 'Suwanee', 'Norcross',
] as const;

export type ServiceArea = (typeof SERVICE_AREAS)[number];

// TODO (owner): confirm ZIP coverage. Starter list of 41 ZIPs for the nine service-area cities.
export const SERVICE_ZIPS: Readonly<Record<string, ServiceArea>> = {
  '30303': 'Atlanta', '30305': 'Atlanta', '30306': 'Atlanta', '30307': 'Atlanta', '30308': 'Atlanta',
  '30309': 'Atlanta', '30310': 'Atlanta', '30312': 'Atlanta', '30313': 'Atlanta', '30314': 'Atlanta',
  '30315': 'Atlanta', '30316': 'Atlanta', '30317': 'Atlanta', '30318': 'Atlanta', '30324': 'Atlanta',
  '30326': 'Atlanta', '30327': 'Atlanta', '30342': 'Atlanta', '30363': 'Atlanta',
  '30060': 'Marietta', '30062': 'Marietta', '30064': 'Marietta', '30066': 'Marietta', '30067': 'Marietta', '30068': 'Marietta',
  '30328': 'Sandy Springs', '30350': 'Sandy Springs',
  '30075': 'Roswell', '30076': 'Roswell',
  '30004': 'Alpharetta', '30005': 'Alpharetta', '30009': 'Alpharetta', '30022': 'Alpharetta',
  '30030': 'Decatur', '30032': 'Decatur', '30033': 'Decatur',
  '30319': 'Brookhaven',
  '30024': 'Suwanee',
  '30071': 'Norcross', '30092': 'Norcross', '30093': 'Norcross',
};

/** The city for a served ZIP, or null when it's outside the area (→ waitlist). */
export function cityForZip(zip: string): ServiceArea | null {
  return SERVICE_ZIPS[zip.trim()] ?? null;
}

// ───────── Scheduling ─────────

export type ArrivalWindowId = 'morning' | 'midday' | 'afternoon';

// startHour/endHour are Atlanta time; the 24-hour change rule counts from startHour.
export const ARRIVAL_WINDOWS: readonly { id: ArrivalWindowId; label: string; time: string; short: string; spoken: string; startHour: number; endHour: number }[] = [
  { id: 'morning', label: 'Morning', time: '8–11 am', short: '8–11 AM', spoken: 'between 8 and 11 am', startHour: 8, endHour: 11 },
  { id: 'midday', label: 'Midday', time: '11 am–2 pm', short: '11 AM–2 PM', spoken: 'between 11 am and 2 pm', startHour: 11, endHour: 14 },
  { id: 'afternoon', label: 'Afternoon', time: '2–5 pm', short: '2–5 PM', spoken: 'between 2 and 5 pm', startHour: 14, endHour: 17 },
];

export type RouteDayId = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

// Pet route days are Monday–Friday. `day` is the JS weekday (0 = Sunday).
export const ROUTE_DAYS: readonly { id: RouteDayId; day: number; full: string }[] = [
  { id: 'Mon', day: 1, full: 'Monday' },
  { id: 'Tue', day: 2, full: 'Tuesday' },
  { id: 'Wed', day: 3, full: 'Wednesday' },
  { id: 'Thu', day: 4, full: 'Thursday' },
  { id: 'Fri', day: 5, full: 'Friday' },
];

export const BOOKING = {
  holdMinutes: 15, // a chosen slot is held this long during checkout
  windowDays: 60, // how far ahead a visit can be booked
  firstBookableOffsetDays: 1, // tomorrow at the earliest
  firstRouteOffsetDays: 2, // first yard visit at least 2 days out
} as const;

// Starting capacity, set by hand on the owner dashboard. Index = JS weekday (0 = Sunday).
// Values are visits per arrival window [morning, midday, afternoon].
export const CAPACITY_DEFAULTS = {
  cleaningPerWindow: [
    [0, 0, 0], // Sunday — closed
    [2, 2, 1], [2, 2, 1], [2, 2, 1], [2, 2, 1], [2, 2, 1], // Monday–Friday
    [1, 1, 0], // Saturday
  ] as readonly (readonly [number, number, number])[],
  yardsPerRouteDay: { Mon: 12, Tue: 12, Wed: 10, Thu: 12, Fri: 8 } as Record<RouteDayId, number>,
} as const;

// ───────── Links, reminders and automations ─────────

export const LINKS = {
  manageLinkDays: 7, // /b/[token] signed link expiry; re-sent on request
  jobLinkHoursAfterVisit: 24, // /job/[token] expires 24h after the visit
  jobAccessUnlockHour: 6, // full address + access codes unlock at 6 AM on the visit day
  proDocsLinkDays: 14, // the link a pro uses to upload documents
} as const;

export const AUTOMATIONS = {
  unassignedFirstReminderHours: 12,
  unassignedDailyReminderHour: 8, // then every morning at 8 until assigned
  proDayOfReminderHour: 6,
  eveningBeforeReminderHour: 18,
  paymentFailedReminderHours: 24, // one reminder after 24h
  cardUpdateDeadlineHours: 48, // plan pauses after this
  quoteReplyBusinessHours: 2,
  proDocExpiryWarningDays: 30,
  marketingTextsPerMonthMax: 2,
  ratingEmailDaysAfterFirstVisit: 1,
  ratingEmailHour: 10, // the day after the first visit, from 10 AM
  lowRatingAlertMax: 3, // a rating of 3 or less texts the owner
  recurringChargeHour: 7, // recurring cleans are charged from 7 AM on the visit day
  unassignedLookaheadDays: 7, // the 8 AM reminder covers visits in the next week (and every new booking)
  pendingBookingCleanupHours: 2, // checkout never finished → release the booking
  failedChargeFollowUpDays: 14, // stop chasing a declined charge after this
  onTheWayEtaMinutes: 30, // "I’m on my way" tells the customer: arriving by now + 30 minutes (rounded up to 5)
} as const;

// ───────── Pros ─────────

// A pro is assignable only with every document uploaded, verified and unexpired.
export const PRO_REQUIRED_DOCUMENTS = ['insurance', 'bond', 'background_check'] as const;

// ───────── Client storage ─────────

// Step 1 choices carry between pages in localStorage.
export const STORAGE_KEYS = {
  cleanStep1: 'booking-step1',
  pet: 'booking-pet',
  service: 'booking-service', // 'clean' | 'pet' — which flow /book opens
} as const;

export const BOOKING_REF_PREFIX = 'FH';
