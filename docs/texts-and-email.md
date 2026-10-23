# Texts and email — connecting Twilio and Resend

The site already writes, logs and sends every message. Until the keys below are added it
runs without them: each message is still logged in the `messages` table, marked
`failed` / `not_configured`, and nothing leaves the site.

All wording lives in `lib/messages.ts` (copied from `design/Messages.dc.html`).
`lib/notify.ts` fills in the details and sends each message once. Texts go only to
numbers with a live consent in `sms_consent`; STOP ends that consent and START restores it.

## Twilio (texts)

1. Create the account and finish **A2P 10DLC registration** first. The answers are at the
   bottom of `design/Messages.dc.html`, and the checklist is in `HANDOFF.md`. Carriers block
   unregistered business texts.
2. Make a **Messaging Service** and add (678) 439-6213 to it (ported or verified), then in that service:
   - turn on **Smart Encoding**, so curly quotes and dashes don't double the cost of a text;
   - under **Advanced Opt-Out**, set the replies to the exact STOP, HELP and START copy in
     `lib/messages.ts`, and **remove YES from the opt-in keywords**. Customers reply YES to the
     yard cleanup-upgrade question, and that must not count as a re-subscribe.
     The site records STOP / START either way and doesn't reply twice;
   - set **Incoming messages** to the webhook `https://<your-domain>/api/twilio/sms` (HTTP POST).
3. Add the keys in the hosting environment's settings. Never paste them into a chat or commit them:
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM` — the Messaging Service SID (starts with `MG`)
   - `SITE_ORIGIN=https://<your-domain>` — Twilio signs each webhook with the public address, and
     delivery reports (`/api/twilio/status`) are only requested when this is an https address.

Customer replies that aren't keywords are emailed to the owner's inbox. Answer them by text
from the business number, not by replying to the email.

## Resend (email)

1. Add and verify the sending domain (the DNS records Resend lists), so mail can come from
   `bookings@<your-domain>`. Replies go to the Gmail address in `lib/config.ts`.
2. Add `RESEND_API_KEY` in the hosting environment's settings.

## Owner alerts

- `OWNER_ALERT_MOBILE` — your own mobile in +1 format, for new-booking, declined-card,
  quote and re-clean alerts. These texts skip the consent check because they go to you.
- `OWNER_ALERT_EMAIL` — optional; defaults to the business Gmail.

## Testing locally

The tests run against a local stand-in for both services (`TWILIO_API_BASE` and
`RESEND_API_BASE` point at it), so no account or key is needed to test.
