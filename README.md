# Fernhouse — start here

This folder is everything Claude Code needs to build the Fernhouse website.

- `HANDOFF.md` — the build spec: decisions, stack, pages, pricing, data model, texts, build order.
- `design/` — the design files, one HTML file per screen (`Main`, `PetWaste`, `Booking`, `ManageBooking`, `Admin`, `ProJob`, `Messages`, `Legal`, `NotFound`, plus phone/tablet wrappers). Prices, copy and message templates are written as code constants inside them.
- `design/canvas.json` — which frame is which, with titles and sizes.

## First prompt to paste into Claude Code

> Read `README.md` and `HANDOFF.md`, then look through every file in `design/`. Build the Fernhouse site described in `HANDOFF.md` as a Next.js app in this folder, matching the design files screen for screen on phone, tablet and desktop. Follow the build order one step at a time: finish step 1, show me what you built, and wait for my OK before moving on. Never type prices or copy into pages — put them in `lib/config.ts` and `lib/messages.ts`. Ask me before creating any paid account or using real API keys.

## After the first step

- Say "next step" to continue down the build order.
- When Claude Code needs Stripe, Supabase, Twilio or Resend, it will ask you to create the account and paste the keys into a `.env.local` file. Keep that file private.
- To see a design file yourself, ask Claude Code to "serve the design folder" and open the link it gives you.
