# Scheduled jobs

Vercel Cron calls `/api/cron` once an hour (`vercel.json`). Each run checks the Atlanta time
and does whatever is due. Every job is safe to run twice: charges use Stripe idempotency keys
and messages use send-once keys. If a run is missed, the next one catches up.

| Job | When (Atlanta time) | What it does |
| --- | --- | --- |
| `extendSchedules` | every run | Keeps each recurring plan's visits filled in 60 days ahead |
| `releaseStaleBookings` | every run | Releases bookings whose checkout never finished after 2 hours. If Stripe says the booking was paid, it confirms it instead |
| `chargeRecurringCleans` | from 7 AM | Charges recurring cleans on the visit day. A run missed for up to 2 days catches up |
| `eveningReminders` | from 6 PM | Sends the evening-before text for tomorrow's cleans |
| `unassignedReminders` | 12 h after booking; from 8 AM daily | Texts the owner about bookings that still need a pro |
| `followUpDeclines` | 24 h / 48 h after a decline | Sends one reminder text, then pauses a recurring plan (once) and tells the customer and owner |
| `ratingEmails` | from 10 AM, the day after a first visit | Emails the private 1–5 rating, once per customer |
| `cleanUp` | every run | Deletes access notes and gate codes after service ends, plus expired links and holds |

When a customer saves a new card, any declined visit charges are retried straight away
(Stripe webhook).

The pro's 6 AM day-of text comes with the pro job page in build step 9.

## Setup

- Add `CRON_SECRET` (a long random string) to the Vercel project's environment variables.
  Vercel sends it with every cron call, and the endpoint refuses calls without it.
- An hourly schedule needs a Vercel plan that allows it. Vercel's free Hobby plan only runs a
  cron job once a day, and won't deploy an hourly one. If you stay on Hobby, a free scheduler
  (for example a GitHub Actions schedule) can call the same address every hour with the same
  header, and `vercel.json` would drop its `crons` entry.
- Run it by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron`
  (add `?only=eveningReminders` to run one job). The reply lists what each job did.
