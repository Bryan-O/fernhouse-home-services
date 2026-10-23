# Fernhouse — instructions for Claude Code

Fernhouse is a house-cleaning and pet-waste-removal booking business in Atlanta, GA. The customer always books and pays Fernhouse; vetted independent pros do the work.

- **Read `HANDOFF.md` before any work.** It holds the decisions, stack, pricing, routes, data model, messages and build order.
- The design lives in `design/` — one `.dc.html` file per screen (`design/canvas.json` maps them). Match it screen for screen at phone, tablet and desktop widths.
- **`design/` is read-only.** It is synced from the Claude design canvas, and every design change is pushed there. Never edit, move or delete files in `design/`. When a commit changes `design/`, check the changed screens and update the built pages to match.
- Follow the build order in `HANDOFF.md` one step at a time. After each step, show the owner what changed and wait for an OK.
- All prices, policies and ZIP codes go in `lib/config.ts`; all customer-facing message copy in `lib/messages.ts`. Never type them into pages.
- Design rules: no pro names, photos or bios shown to customers; no fake reviews, ratings or stats; no license numbers; never use the words subcontractor, partner or marketplace; the 20% first-clean offer appears once; WCAG AA with visible focus states.
- Secrets live only in `.env.local`, which is git-ignored. Never commit keys. Ask the owner before creating paid accounts or using live keys.
- Commit and push to GitHub at the end of each build step.
