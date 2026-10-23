# Analytics and ads

Google Analytics 4 and the Meta Pixel load only on the public pages listed in
`lib/config.ts` → `TRACKING.pages`. They never load on manage links (`/b/…`), pro job links
(`/job/…`) or the owner dashboard, because those addresses contain private tokens. Page views
are sent without the query string (UTM tags are kept), so a Stripe session ID or a click ID
never reaches either service.

A browser that sends **Global Privacy Control** gets neither tool. Its bookings and quotes are
marked `ads_ok = false`, so the server doesn't report them to Meta either.

## Events

| When | Google Analytics 4 | Meta |
| --- | --- | --- |
| Every public page | `page_view` | `PageView` (Pixel) |
| Pay / save card clicked (leaving for Stripe) | `begin_checkout` (value of the first visit) | `InitiateCheckout` (Pixel) |
| Booking paid / card saved | `purchase` on the confirmation page, once per booking (`transaction_id` = booking reference) | `Purchase` from the server (Conversions API), `event_id` = booking reference |
| Quote request | `generate_lead` | `Lead` from the Pixel **and** the server, same `event_id` (`quote-<id>`), so Meta counts it once |
| Waitlist sign-up | `join_waitlist` | — |

The Pixel is left off the confirmation page because its address holds the Stripe session.
Meta gets the Purchase from the server instead, matched by hashed email and the ad-click
cookies (`fbc` from the saved `fbclid`, `fbp`). **Phone numbers are never sent to Meta.**

## Where a booking came from

UTM tags (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`) and click
IDs (`fbclid`, `gclid`) from the landing page are kept in the visitor's browser for 30 days
(last click wins). They're saved on each booking (`plans`) and quote (`quote_requests`).

## Setup

1. **GA4:** create a property and a web data stream, and copy the Measurement ID (`G-…`) into
   `NEXT_PUBLIC_GA4_ID`. In the stream's Enhanced measurement settings, turn **off** "Page
   changes based on browser history events" (the site sends its own page views). Mark
   `purchase` and `generate_lead` as key events.
2. **Meta:** in Events Manager, copy the Pixel ID into `NEXT_PUBLIC_META_PIXEL_ID`. Under
   Settings → Conversions API, generate an access token and put it in `META_CAPI_TOKEN`
   (server only). While testing, put the Test Events code in `META_CAPI_TEST_CODE`.
3. Add these in the hosting environment's settings, then redeploy, because `NEXT_PUBLIC_`
   values are built into the pages.

Without the IDs, nothing loads and nothing is sent.
