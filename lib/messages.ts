// Customer-facing message copy: text-message consent wording now; every text and
// email template (design/Messages.dc.html) is added in build step 7.
// Consent wording is saved with each consent in `sms_consent`, so bump the version
// whenever the wording changes.

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

export const QUOTE = {
  sent: (phone: string) => `Thanks — we’ll text ${phone} with your quote.`,
  intro: 'Leave your mobile number and we’ll text you a quote today — no payment needed.',
  titleDogs: '5 or more dogs? Let’s quote your yard.',
  titleYard: 'Yard over ½ acre? Let’s quote it.',
} as const;
