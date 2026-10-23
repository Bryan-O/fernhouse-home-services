# Launch checklist

In order. Every key goes into the hosting environment's settings (Vercel → Project → Settings →
Environment Variables), never into code or chat. `.env.example` lists each one.

## 1. Business decisions (no code)

- [ ] Legal entity: an LLC with an EIN, or sole proprietor. This decides the text-message registration type.
- [ ] Georgia attorney review of the Terms and Privacy Policy (`app/terms`, `app/privacy`; values in `lib/config.ts` → `LEGAL`).
- [ ] Ask an insurance agent whether Fernhouse itself needs general liability cover.
- [ ] Confirm the 41 service ZIPs (`lib/config.ts` → `SERVICE_ZIPS`) and the "next size up" pricing rule (`lookupHome`).
- [ ] Yard photo for the home page's pet card and the pet waste page (two `TODO (owner)` placeholders).
- [ ] Recruit the first pros for each area, and check their insurance, bond and background check (Pros tab).

## 2. Accounts and domain

- [ ] Buy the domain. If it isn't fernhouseclean.com, change `BRAND.domain` in `lib/config.ts`.
- [ ] **Vercel:** import the GitHub repo. Choose a plan for the hourly jobs (`docs/scheduled-jobs.md`: Pro, or a free external scheduler), and add the domain.
- [ ] **Supabase:** create the project, push the schema and create the owner account (`supabase/README.md`).
- [ ] **Field encryption:** generate `FIELD_ENCRYPTION_KEY` once and keep a copy somewhere safe. Losing it makes saved access notes unreadable.
- [ ] `SITE_ORIGIN=https://<your-domain>` and `CRON_SECRET` (a long random string).

## 3. Payments (Stripe)

- [ ] Start in **test mode**: `STRIPE_SECRET_KEY=sk_test_…`, with a webhook to `https://<domain>/api/stripe/webhook` for the six events listed in `.env.example`, and `STRIPE_WEBHOOK_SECRET`.
- [ ] Make test bookings (card `4242 4242 4242 4242`). Try a declined card (`4000 0000 0000 0341`), a cancel inside 24 hours, a reschedule, and marking a visit done from the job page.
- [ ] Switch to live keys and a live webhook only after that works.

## 4. Texts and email (`docs/texts-and-email.md`)

- [ ] **Twilio:** start text-message registration (brand, then campaign) as soon as the site is live at its real domain. It takes 1–3 weeks. Then set up the Messaging Service (Smart Encoding, Advanced Opt-Out with our STOP/HELP/START copy and YES removed from opt-in keywords, incoming webhook), and add the keys.
- [ ] **Resend:** verify the sending domain and add `RESEND_API_KEY`.
- [ ] `OWNER_ALERT_MOBILE` (your mobile) and, if you like, `OWNER_ALERT_EMAIL`.
- [ ] Text STOP, HELP and START to the business number and check the replies.

## 5. Analytics and ads (`docs/analytics-and-ads.md`)

- [ ] GA4 Measurement ID. Turn off history-based page views, and mark `purchase` and `generate_lead` as key events.
- [ ] Meta Pixel ID and Conversions API token. Check a test booking in Events Manager → Test events.

## 6. Final checks on the live site

- [ ] Book a real clean and a real yard plan with your own card, then refund them from Stripe.
- [ ] Find my booking → the text arrives → reschedule and cancel work.
- [ ] Assign a pro → their text and job link work. On the visit day: on my way, gate photo, mark done → the customer's text and receipt.
- [ ] The next morning: the hourly jobs ran (Vercel → Cron Jobs shows the runs).
- [ ] `/robots.txt` and `/sitemap.xml` load. Submit the sitemap in Google Search Console.

## What the site already does at launch

- Pages pass an automated WCAG 2.2 AA check (axe), plus keyboard checks: visible focus everywhere, no sideways scrolling at 320px, focus moved to errors and new steps, reduced motion respected.
- Security headers on every page. Manage and job links send no referrer and aren't indexed.
- Public forms that send texts are rate-limited (`lib/config.ts` → `LIMITS`).
- Friendly error and 404 pages. Nothing technical is shown to customers.
