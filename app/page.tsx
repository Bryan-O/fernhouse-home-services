import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { HomeHero } from '@/components/HomeHero';
import { Faq } from '@/components/Faq';
import { PricingExplorer } from '@/components/PricingExplorer';
import { PickCleanLink } from '@/components/PickCleanLink';
import { FinalCta, HowSteps, ServiceAreas, TrustStrip, WhyCard } from '@/components/Sections';
import { CalendarRepeat, Check, Clipboard, Key, Paw, PhoneCheck, PhoneDevice, Redo, Shield, Sparkle, Team } from '@/components/Icons';
import {
  BRAND,
  CANCELLATION_POLICY,
  OFFER,
  PET_WASTE_PRICING,
  POLICIES,
  popularHome,
  PRICING,
  type CleanService,
} from '@/lib/config';

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} — House Cleaning in Atlanta, GA | Book Online in 60 Seconds` },
  description: `Book a vetted, background-checked house cleaner in ${BRAND.areaLine} online in 60 seconds. Clear prices, a re-clean guarantee and no contracts.`,
};

const G = POLICIES.guaranteeWindow;

const FAQS = [
  ['How do I pay?', 'Secure card payment online when you book — you pay us, never pay your cleaner directly.'],
  ['Who will clean my home?', 'A vetted, background-checked pro from our Atlanta network — your assigned team. Every pro is screened before their first job and carries their own bonding and liability insurance, which we verify.'],
  ['What if I’m not happy with the clean?', `Tell us within ${G} and we’ll re-clean the area free. That’s our guarantee.`],
  ['Do I need to be home?', 'No. Most customers give access instructions at booking — a key, a code, or a garage — and come home to a clean house.'],
  ['What about pets and supplies?', 'Pets are welcome — just note them when you book so your team is prepared. Your team brings all supplies and equipment.'],
  ['What day does pet waste removal happen?', 'You pick a preferred weekday when you book, and we scoop on that route day every week. If weather moves a visit, we text you the new day.'],
  ['Do I need to be home for pet waste removal?', 'No. Leave the gate unlocked or share the code, and we text you a photo of your latched gate after every visit.'],
  ['What happens to the dog waste?', 'We bag it and haul it away — nothing is left in your trash bin.'],
  ['What if my dogs are in the yard?', 'Tell us when you book whether they’re friendly. If not, keep them inside on your route day. If we can’t safely enter, we text you and come back.'],
  ['Can I get the same cleaner every time?', 'You can request it and we’ll do our best. We rotate teams when needed so your slot is always covered — that’s how we guarantee your clean never gets cancelled.'],
  ['How do recurring plans work?', 'Pick weekly or biweekly. We book your standing slot, remind you before each visit, and you can pause or cancel anytime from your confirmation link — no contracts, no phone call needed.'],
  ['What is the cancellation policy?', CANCELLATION_POLICY],
] as const;

const SERVICES: { id: CleanService; title: string; lead: string; items: string[]; per: string; Icon: typeof Sparkle }[] = [
  {
    id: 'standard', title: 'Standard Cleaning', lead: 'Reliable upkeep for busy homes.', per: 'per visit, biweekly', Icon: CalendarRepeat,
    items: ['Kitchen surfaces and sink', 'Bathroom sanitizing', 'Dusting and mirrors', 'Floors vacuumed and mopped', 'Trash out, beds made'],
  },
  {
    id: 'deep', title: 'Deep Cleaning', lead: 'A full reset, top to bottom.', per: 'per visit', Icon: Sparkle,
    items: ['Everything in Standard, plus:', 'Baseboards, blinds, ceiling fans', 'Inside oven and microwave', 'Grout scrubbing', 'Doors and light switches'],
  },
  {
    id: 'move', title: 'Move-In/Out Cleaning', lead: 'Ready for handover, keys in hand.', per: 'per visit', Icon: Key,
    items: ['Everything in Deep, in an empty home', 'Inside cabinets and drawers', 'Inside all appliances', 'Walls spot-cleaned', 'For renters, buyers, sellers, landlords'],
  },
];

export default function HomePage() {
  const from = PRICING.rows[0];
  const anchor = popularHome();
  return (
    <div className="page">
      <a className="skip-link" href="#booking">Skip to booking</a>
      <SiteHeader variant="home" />

      <main id="top">
        <HomeHero />
        <TrustStrip guarantee="Re-clean guarantee" />

        {/* Services */}
        <section id="services" aria-label="Services" style={{ background: '#FFFFFF' }}>
          <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div className="sec-intro">
              <h2 className="display h2">Three ways to a clean home</h2>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>Every clean is done by your assigned team, with all supplies included.</p>
            </div>
            <div className="grid-3">
              {SERVICES.map(({ id, title, lead, items, per, Icon }) => (
                <article key={id} className="svc-card">
                  <span aria-hidden="true" className="icon-tile"><Icon stroke="var(--accent)" /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h3 className="display h3">{title}</h3>
                    <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>{lead}</p>
                  </div>
                  <ul className="small check-list">
                    {items.map((t) => <li key={t}><Check size={18} stroke="var(--accent)" style={{ flex: 'none', marginTop: 2 }} />{t}</li>)}
                  </ul>
                  <div className="svc-foot">
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="small" style={{ color: 'var(--muted)' }}>From</span>
                      <span className="display" style={{ fontSize: 30, lineHeight: '34px', color: 'var(--accent)' }}>${from[id]}</span>
                      <span className="small" style={{ color: 'var(--muted)' }}>{per}</span>
                    </div>
                    <PickCleanLink service={id} className="btn btn-secondary btn-sm">Book this</PickCleanLink>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* First-clean offer — the one canonical offer on the page */}
        <section aria-label="First-clean offer" style={{ background: '#FFFFFF' }}>
          <div className="wrap" style={{ paddingBottom: 24 }}>
            <div className="offer-band">
              <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h2 className="display h2">{OFFER.firstCleanPct}% off your first clean.</h2>
                <p className="body" style={{ margin: 0, color: 'var(--ink-2)', maxWidth: '60ch' }}>
                  New customers save {OFFER.firstCleanPct}% on their first booking — our way of earning a recurring spot on your calendar.
                </p>
              </div>
              <a className="btn btn-primary btn-block-m" href="#booking">Get {OFFER.firstCleanPct}% off my first clean</a>
            </div>
          </div>
        </section>

        <HowSteps
          steps={[
            { icon: <PhoneDevice stroke="var(--accent)" />, title: 'Book online in 60 seconds', body: 'Pick your clean, your home size and your time. Pay securely online.' },
            { icon: <Shield stroke="var(--accent)" />, title: 'We dispatch your vetted team', body: 'A background-checked pro from our Atlanta network arrives with all supplies.' },
            { icon: <Redo stroke="var(--gold)" />, title: 'Love it, or we re-clean', body: `If anything isn’t right, tell us within ${G} and we come back and re-clean it, free.` },
          ]}
        />

        {/* Why book with us */}
        <section aria-label="Why book with us" style={{ background: 'var(--paper-2)' }}>
          <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div className="sec-intro">
              <h2 className="display h2">Why book with Fernhouse</h2>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>Everything that goes wrong when you hire on your own — handled before it happens.</p>
            </div>
            <div className="why-grid">
              <WhyCard filled icon={<Shield stroke="var(--accent)" />} title="A team that’s vetted, bonded and insured">
                Every pro is background-checked before their first job and carries their own bonding and liability insurance, which we verify before they’re booked.
              </WhyCard>
              <WhyCard filled icon={<Team stroke="var(--accent)" />} title="Your clean never gets cancelled">
                If your pro is sick, a backup from our team covers your slot. Hiring solo, one illness means no clean.
              </WhyCard>
              <WhyCard filled gold icon={<Redo stroke="var(--gold-ink)" />} title="Not right? We re-clean it">
                Tell us within {G} and we come back to re-clean the area, free.
              </WhyCard>
              <WhyCard filled icon={<Clipboard stroke="var(--accent)" />} title="We remember how you like it">
                Your preferences and checklist are saved, so every visit matches the last.
              </WhyCard>
              <div className="why-wide on-dark">
                <div style={{ display: 'flex', gap: 16, flex: '1 1 380px', minWidth: 0 }}>
                  <span aria-hidden="true" className="icon-tile icon-tile-dark"><PhoneCheck stroke="#FFFFFF" /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3 className="display h3">Rebook in one tap</h3>
                    <p className="body" style={{ margin: 0, color: 'var(--footer-ink)' }}>Manage a recurring plan without phone calls — pause or reschedule from your phone.</p>
                  </div>
                </div>
                <a className="btn btn-white btn-block-m" href="#booking">Start a recurring plan</a>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" aria-label="Pricing" style={{ background: '#FFFFFF' }}>
          <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div className="sec-intro">
              <h2 className="display h2">Clear pricing. No quotes, no surprises.</h2>
            </div>
            <PricingExplorer />
            <p className="small" style={{ margin: 0, color: 'var(--muted)', maxWidth: '65ch' }}>
              Standard prices shown are for biweekly recurring service. Weekly and one-time cleans are priced differently. All prices are starting prices for homes in normal condition.
            </p>
          </div>
        </section>

        {/* Slim pet waste band — the home page's only pet waste section outside the hero */}
        <section aria-label="Pet waste removal" style={{ background: '#FFFFFF' }}>
          <div className="wrap" style={{ paddingBottom: 48 }}>
            <div className="pet-band">
              <p className="body" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 360px', minWidth: 0 }}>
                <span aria-hidden="true" className="icon-tile icon-tile-sm"><Paw size={22} stroke="var(--accent)" /></span>
                <span><strong>Got a dog?</strong> We keep yards clean too — weekly pet waste removal from ${PET_WASTE_PRICING.weekly1Dog}/visit.</span>
              </p>
              <Link className="btn btn-secondary btn-block-m" href="/pet-waste-removal">See pet waste removal</Link>
            </div>
          </div>
        </section>

        <ServiceAreas id="areas" note />

        {/* Customer reviews: hidden until real reviews exist — never sample text. */}

        <Faq title="Questions, answered" items={FAQS} />

        <FinalCta
          label="Book now"
          title="Your home, cleaned this week."
          line={`${anchor.bd} bd / ${anchor.ba} ba biweekly from $${anchor.standard} per visit.`}
          cta="Book now"
        />
      </main>

      <SiteFooter variant="home" />
      <div className="mbar-space" aria-hidden="true" />
    </div>
  );
}
