# Scheduled jobs

A free GitHub Actions schedule (`.github/workflows/hourly-jobs.yml`) calls `/api/cron` once an hour. Each run checks the Atlanta time
and does whatever is due. Every job is safe to run twice: charges use Stripe idempotency keys
and messages use send-once keys. If a run is missed, the next one catches up.

| Job | When (Atlanta time) | What it does |
| --- | --- | --- |
| `extendSchedules` | every run | Keeps each recurring plan's visits filled in 60 days ahead |
| `releaseStaleBookings` | every run | Releases bookings whose checkout never finished after 2 hours. If Stripe says the booking was paid, it confirms it instead |
| `chargeRecurringCleans` | from 7 AM | Charges recurring cleans on the visit day. A run missed for up to 2 days catches up |
| `proDayOfTexts` | from 6 AM | Texts each cleaning pro their visit, and each yard pro one text linking to the day's route |
| `eveningReminders` | from 6 PM | Sends the evening-before text for tomorrow's cleans |
| `unassignedReminders` | 12 h after booking; from 8 AM daily | Texts the owner about bookings that still need a pro |
| `followUpDeclines` | 24 h / 48 h after a decline | Sends one reminder text, then pauses a recurring plan (once) and tells the customer and owner |
| `ratingEmails` | from 10 AM, the day after a first visit | Emails the private 1–5 rating, once per customer |
| `docExpiryWarnings` | every run | Texts the pro and the owner once, 30 days before insurance or a bond expires |
| `cleanUp` | every run | Deletes access notes and gate codes after service ends, plus expired customer and pro links, and old holds |

When a customer saves a new card, any declined visit charges are retried straight away
(Stripe webhook).

## Setup

- Add `CRON_SECRET` (a long random string) to the Vercel project's environment variables. The
  endpoint refuses any call without it.
- In GitHub → the repository → Settings → Secrets and variables → Actions, add two secrets:
  `CRON_URL` (`https://<your-site>/api/cron`) and `CRON_SECRET` (the same value). Until both are
  set, each hourly run just skips.
- GitHub runs schedules only from the repository's default branch, so the jobs start once this
  branch is merged there. GitHub can start a scheduled run a few minutes late; the jobs don't mind.
- Run it by hand: GitHub → Actions → **Hourly jobs** → Run workflow, or
  `curl -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron`
  (add `?only=eveningReminders` to run one job). The reply lists what each job did.
- If you move to Vercel Pro later, Vercel Cron can replace this: add
  `{"crons": [{"path": "/api/cron", "schedule": "0 * * * *"}]}` as `vercel.json`, and delete the
  workflow so the jobs aren't called twice. Calling them twice does no harm, but it's wasted work.
