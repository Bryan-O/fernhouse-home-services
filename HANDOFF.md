# Fernhouse — Claude Code Handoff

Oct 22, 2026

The design is complete enough to build: every customer screen, the booking and manage-booking flows, all texts and emails, and the legal pages are drawn and measured. The owner dashboard and the pros’ job page are designed too, so every screen to be built has a frame.

## Start here

The design files are in `design/` (49 frames across 7 canvas pages; `design/canvas.json` maps them). Each frame is an HTML file, and the pricing and copy are already written as code constants inside them — lift them into `lib/config.ts` and `lib/messages.ts` rather than retyping.

Design rules that must survive the build: no cleaner names, photos or bios; no fake reviews, ratings or stats; no license numbers; never use the words subcontractor, partner or marketplace; the 20% first-clean offer appears once; every price renders from `lib/config.ts`; the customer always pays Fernhouse; WCAG AA with visible focus, hover and disabled states; phone-first layouts.

## Decisions already made

| Item | Decision |
| --- | --- |
| Business | Fernhouse — house cleaning and pet waste removal, Atlanta, GA and suburbs |
| Phone (calls + texts) | (678) 439-6213 |
| Email | fernhousehomeservices@gmail.com (customer replies go here) |
| Domain | fernhouseclean.com — placeholder, not yet bought |
| Sales tax | None (Georgia doesn’t tax these services) |
| First-clean offer | 20% off a new customer’s first home clean, once per household |
| Cancellation | Free until 24 hours before a visit; $50 after |
| Guarantee | Re-clean (cleaning) or re-scoop (yard) if reported within 24 hours |
| “Bonded & insured” | Each pro carries their own bond and liability insurance; Fernhouse verifies it before booking them |
| Pet waste quotes | 5+ dogs or a yard over ½ acre → texted quote, never a guessed price |
| Testimonials | Hidden until real reviews exist |
| Payment timing | First clean charged at booking; recurring cleans the morning of each visit; pet waste after each visit |

## Stack and outside services

| Job | Service | Why |
| --- | --- | --- |
| Website + app | Next.js (App Router, TypeScript) on Vercel | One codebase for pages, booking and admin; free tier to start |
| Database, admin login, photo storage | Supabase (Postgres + Auth + Storage) | Bookings, customers and gate photos in one place |
| Payments | Stripe (Checkout + saved cards) | Card never touches our servers; off-session charges for recurring visits |
| Texts (SMS + photo texts) | Twilio, on the (678) 439-6213 number | Handles registration, STOP/HELP, MMS gate photos |
| Email | Resend, sending from `bookings@fernhouseclean.com` with reply-to the Gmail address | Gmail can’t be used as the sender for automated mail |
| Scheduled jobs | Vercel Cron | Reminders, recurring charges, link expiry |
| Analytics | Google Analytics 4 + Meta Pixel and Conversions API | Matches the Privacy Policy; needed for Facebook ads |

Keep Twilio, Stripe and Supabase keys in environment variables only.

## Pages and routes

| Route | What it is | Design frames |
| --- | --- | --- |
| `/` | Home: hero with Home Cleaning / Pet Waste booking card, services, pricing, how it works, FAQ | Main, Mobile, TabletPortrait, TabletLandscape |
| `/pet-waste-removal` | Pet waste page with its own booking card | PetWaste, PetWastePhone |
| `/book` | 4-step booking for cleaning; `?service=pet-waste` for yard service | Booking, every BookingPhone frame, the 3 BookingDesktop-Pet frames, BookingReviewDesktop |
| `/book/confirmed` | Confirmation (recurring, one-time + upsell, pet) | ConfirmedDesktop, BookingPhone-Confirmed, BookingPhone-PetConfirmed |
| `/manage` | Find my booking: phone → texted link | ManagePhone-Find |
| `/b/[token]` | Manage booking: reschedule, skip, pause, cancel (late fee inside 24h), card, notes, re-clean/re-scoop | ManageBooking, ManageDesktop-Pet, ManagePhone frames |
| `/privacy`, `/terms` | Legal pages | Legal, Terms |
| 404 | Not found | NotFound, NotFoundPhone |
| `/admin` | Owner dashboard: Today (needs a pro, today’s visits, failed payments, quotes, pro documents, waitlist), Assign a pro, Capacity, Pros | Admin, AdminDesktop-Capacity, AdminDesktop-Pros, AdminPhone frames |
| `/job/[token]` | Pro’s job page: details, access unlocked on the day, on my way, gate photo (required for yards), yard condition, mark done | ProJob, ProJob-Upcoming, -Today, -Pet, -Done |

Problem states already drawn: ZIP outside the area (with waitlist), fully booked date, field errors, payment failed, loading, redirect to checkout.

## Pricing rules

All prices live in `lib/config.ts`; nothing is typed into a page.

**Home cleaning — starting price per visit (biweekly Standard)**

| Home | Standard | Deep | Move-in/out |
| --- | --- | --- | --- |
| 1 bed, 1 bath | $110 | $230 | $250 |
| 2 bed, 1 bath | $125 | $270 | $290 |
| 2 bed, 2 bath | $140 | $300 | $325 |
| 3 bed, 2 bath (most popular) | $165 | $360 | $390 |
| 3 bed, 3 bath | $180 | $395 | $425 |
| 4 bed, 3 bath | $200 | $440 | $475 |
| 4 bed, 4 bath | $220 | $480 | $520 |
| 5 bed, 4 bath | $245 | $540 | $580 |

- Weekly Standard = 10% below biweekly; one-time Standard = 15% above; round to the nearest $5.
- First clean: 20% off for new customers. Whole-dollar totals, no tax.
- More than 5 beds or 4 baths → “call for a custom quote”.

**Pet waste removal — per visit, yards up to ½ acre**

| Dogs | Weekly | Twice weekly | Every other week | One-time yard reset |
| --- | --- | --- | --- | --- |
| 1 | $24 | $20 | $32 | $89 |
| 2 | $27 | $23 | $35 | $89 |
| 3 | $30 | $26 | $38 | $89 |
| 4 | $33 | $29 | $41 | $89 |

- Formula: weekly = $24 + $3 per extra dog; twice weekly = weekly − $4; every other week = weekly + $8.
- First visit = an initial cleanup priced by yard condition: kept up weekly → no cleanup (first visit is the per-visit price); a few weeks behind → $39 with weekly or twice weekly, $75 with every other week; a month or more → $75.
- If the yard needs more than the customer picked, text them before charging the higher rate; they can skip with no fee.
- Add-ons: deodorizer +$12/visit, sanitizing spray +$29. Never flea, tick or pesticide treatment.
- 5+ dogs or over ½ acre → quote request.

**Service area:** 41 ZIP codes across Atlanta, Marietta, Sandy Springs, Roswell, Alpharetta, Decatur, Brookhaven, Suwanee and Norcross, listed as `SERVICE_ZIPS` in `design/Booking.dc.html`. Pet route days are Monday–Friday.

## Booking and payment flow

**Cleaning:** Step 1 service, beds, baths, frequency (home card) → Step 2 ZIP check, date, arrival window (8–11 am, 11 am–2 pm, 2–5 pm) → Step 3 name, mobile, email, access, pets, requests, text consent → Step 4 review, accept Terms, pay.

**Pet waste:** Step 1 frequency, dogs, yard condition → Step 2 ZIP, route day (Mon–Fri), address, gate access (soft warning if blank) → Step 3 details, dog names, friendly or kept inside → Step 4 review, save card. Nothing is charged at booking.

- Step 1 choices carry between pages in `localStorage` (`booking-step1`, `booking-pet`, `booking-service`).
- A chosen slot is held for 15 minutes during checkout; the payment-failed screen shows the countdown.
- Every booking gets a manage link (`/b/[token]`, signed, 7-day expiry, re-sent on request). No customer passwords.
- Charging: the first clean is charged at booking (Stripe Checkout, card saved for later); recurring visits are charged off-session on the morning of each visit; pet waste is charged when the pro marks the visit done.

## How bookings reach the owner

Every booking saves to the database, texts and emails the owner instantly, and waits on the owner dashboard until a pro is assigned. No scheduling software.

1. A customer books. The owner gets a text like “New booking FH-26-04817: Standard clean 3bd/2ba, Tue Oct 27 8–11 AM, Marietta, $132.”
2. The owner confirms with a pro by text or phone.
3. On the dashboard: Assign → pick the pro → Assign & notify. The pro gets the job link; the customer gets “Your team is confirmed.”
4. The pro marks the job done (yards need the gate photo first). That charges the card and sends the receipt.

- Unassigned bookings remind the owner 12 hours later, then every morning at 8 until assigned.
- Capacity is set by hand: visits per arrival window for each weekday, yards per route day, and blocked days. When a slot fills, the booking page shows that date as Full. Starting numbers: 2 / 2 / 1 per window Mon–Fri, 1 / 1 / 0 Saturday, Sunday closed; 8–12 yards per route day.
- Only pros with verified, unexpired insurance, bond and background check appear as assignable.
- Pros are paid outside the app at first (weekly, from the done-jobs list).

## Data model

| Table | Key fields |
| --- | --- |
| `customers` | name, mobile, email, stripe_customer_id, created_at |
| `sms_consent` | customer_id or pro_id, phone, kind (booking / marketing / pro jobs), form (booking, quote, waitlist, pro signup), consent text version, ip, user agent, given_at, revoked_at |
| `addresses` | customer_id, street, unit, city, zip, access_notes (encrypted), gate_code (encrypted) |
| `plans` | customer_id, address_id, service (standard / deep / move / pet), frequency, beds, baths, dogs, yard_condition, price_per_visit, route_day, window, status (active / paused / ended) |
| `visits` | plan_id, date, window, status (scheduled / confirmed / done / skipped / cancelled / no_access), price, fee, pro_id, completed_at, gate_photo_url |
| `payments` | visit_id, stripe_payment_intent, amount, kind (visit / late fee / cleanup upgrade), status |
| `pros` | name, mobile, service types, ZIPs, active |
| `pro_documents` | pro_id, kind (insurance / bond / background check), file_url, expires_on, verified_by, verified_at |
| `capacity` | date or weekday, window or route day, slots available, blocked |
| `quote_requests` | phone, service, dogs, yard size, utm fields, status |
| `waitlist` | phone, zip, created_at |
| `messages` | customer_id or pro_id, channel, template, body, twilio/resend id, status, sent_at |
| `manage_tokens` | customer_id, token hash, expires_at |

Store UTM and click IDs (fbclid, gclid) on every booking and quote so ad results can be measured.

## Texts, emails and automations

Exact copy for every message is in `design/Messages.dc.html`; put it in `lib/messages.ts`. Every text starts with “Fernhouse:” and links only to our own domain (no link shorteners).

| Trigger | Text | Email |
| --- | --- | --- |
| Booking made | Booking confirmed / Yard service booked (with HELP, STOP); New booking alert to owner | Booking confirmation; alert to owner |
| Booking still unassigned | Reminder to owner (12h, then 8 AM daily) | — |
| Owner assigns a pro | Job assigned (to pro); Team confirmed (to customer) | — |
| 6 AM visit day | Day-of reminder (to pro) | — |
| 6 PM the day before | Evening-before reminder | — |
| Pro taps On my way | On the way (optional) | — |
| Visit marked done | Visit done + charge (pet: with gate photo, MMS) | Receipt |
| Yard worse than booked | Cleanup upgrade (reply YES / NO) | — |
| Weather moves a route day | Weather move | — |
| No yard access | Couldn’t get in | — |
| Reschedule / skip / pause | — | Change confirmation |
| Cancelled | Late cancellation (or free version) | Cancellation |
| Charge declined | Payment failed, plus one reminder after 24h; problem alert to owner | Update your card |
| Find my booking | Manage-booking link | — |
| Quote form | Quote request received; price sent by a person | — |
| Pro document expiring | Expiry warning to owner and pro (30 days before) | — |
| Day after first visit | — | Private 1–5 rating (never published) |
| STOP / HELP / START | Required keyword replies | — |

Customer replies to the number go to a shared inbox the owner answers. Never use CANCEL or STOP as reply words — carriers treat them as opt-outs. Log every message in `messages`.

## Text-message registration (A2P 10DLC)

Carriers block unregistered business texts; approval takes about 1–3 weeks. The answers for Twilio’s brand and campaign forms are at the bottom of `design/Messages.dc.html`.

- [ ] Decide the legal entity: an LLC with an EIN registers as a Standard brand; without one, register as a Sole Proprietor (one number, lower limits).
- [ ] Buy the domain and put the site live with `/privacy` and `/terms`.
- [ ] Opt-in wording shows wherever a phone number is collected: booking Step 3, quote form, waitlist, find my booking (already in the design).
- [ ] Marketing consent is a separate, unchecked box; save every consent in `sms_consent` with the exact wording shown.
- [ ] Register brand, then campaign (use case: Low Volume Mixed), with the 5 sample messages and screenshots of the forms.
- [ ] Configure STOP, HELP and START replies in Twilio exactly as designed.
- [ ] Port or verify (678) 439-6213 for texting in Twilio, or buy a new local number if the current line can’t be moved.

## Pros and operations

The site only promises “bonded & insured” because every pro’s own coverage is checked, so the app must enforce it.

- A pro can’t be assigned a visit unless their insurance, bond and background check are uploaded, verified and not expired.
- The pro gets a text with a link to `/job/[token]` (no login; signed per visit; expires 24h after the visit). Full address and access codes unlock at 6 AM on the visit day and are removed after the visit.
- The pro marks the visit done on that page; yard pros must upload the gate photo first. Marking done triggers the charge, the receipt and the guarantee window.
- Customers never see pro names, photos or contact details, and pros never collect payment.
- Pros agree to job texts when they sign up; log that consent like customers’.

## Build order

1. Repo, `lib/config.ts` (brand, prices, ZIPs, policies) and shared styles from the design tokens.
2. Home and pet waste pages, legal pages and 404 — static, responsive, matching every frame.
3. Supabase schema and admin login.
4. Booking flow for cleaning and pet waste with ZIP check, capacity and the 15-minute hold.
5. Stripe: Checkout for the first clean, saved cards, off-session charges, failed-payment handling.
6. Confirmation page and manage-booking (`/manage`, `/b/[token]`) with the 24-hour fee rule.
7. Twilio and Resend with every template, consent logging and STOP/HELP/START.
8. Vercel Cron jobs: reminders, recurring visit creation and charges, token cleanup.
9. Owner alerts, the owner dashboard with capacity settings, and the pro job page with photo upload and document checks.
10. GA4, Meta Pixel and Conversions API; UTM capture.
11. Accessibility pass (keyboard, contrast, screen reader) and a test of every problem state, then launch.

## Still open before launch (owner)

- [ ] Buy the domain (fernhouseclean.com or another) and set up a domain email for automated mail.
- [ ] Check that (678) 439-6213 can be used for business texting.
- [ ] Yard photo for the pet waste page (currently a placeholder).
- [ ] Georgia attorney review of the Privacy Policy and Terms.
- [ ] Recruit and verify the first pros for each ZIP group before ads run.
- [ ] Ask an insurance agent whether Fernhouse itself needs a general liability policy.
- [ ] Text-message registration (checklist above).
