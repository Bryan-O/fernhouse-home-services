import type { Metadata } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { PetHero } from '@/components/PetHero';
import { Faq } from '@/components/Faq';
import { PickCleanLink } from '@/components/PickCleanLink';
import { FinalCta, HowSteps, ServiceAreas, TrustStrip, WhyCard } from '@/components/Sections';
import { Calendar, Camera, Redo, Shield } from '@/components/Icons';
import { BRAND, dogsText, PET_WASTE_PRICING, petVisit, POLICIES } from '@/lib/config';

const P = PET_WASTE_PRICING;
const G = POLICIES.guaranteeWindow;

export const metadata: Metadata = {
  title: 'Pet Waste Removal in Atlanta, GA',
  description: `Weekly dog waste removal in ${BRAND.areaLine} from $${P.weekly1Dog} a visit. Gate photo after every visit, no contracts.`,
};

const FAQS = [
  ['What day do you come?', 'You pick a preferred weekday when you book, and we scoop on that route day every week. If weather moves a visit, we text you the new day.'],
  ['Do I need to be home?', 'No. Leave the gate unlocked or share the code, and we text you a photo of your latched gate after every visit.'],
  ['What happens to the waste?', 'We bag it and haul it away — nothing is left in your trash bin.'],
  ['What if my dogs are in the yard?', 'Tell us when you book whether they’re friendly. If not, keep them inside on your route day. If we can’t safely enter, we text you and come back.'],
  ['What is the initial yard cleanup?', `If waste has built up, the first visit takes longer, so it’s priced by how the yard looks today: nothing extra if it’s kept up weekly, $${P.initialCleanupWithWeekly} if it’s a few weeks behind (with weekly or twice-weekly service), and $${P.initialCleanup} if it’s been a month or more. After that you pay the per-visit price. If the yard needs more than you picked, we text you before charging the higher rate.`],
  ['Do you use any chemicals?', 'Only if you add our pet-safe deodorizer or sanitizing treatment. We never apply flea, tick or any pesticide treatments.'],
] as const;

const DOGS = Array.from({ length: P.maxDogs }, (_, i) => i + 1);

export default function PetWastePage() {
  return (
    <div className="page">
      <a className="skip-link" href="#booking">Skip to booking</a>
      <SiteHeader variant="pet" />

      <main id="top">
        <PetHero />
        <TrustStrip guarantee="Re-scoop guarantee" />

        <HowSteps
          steps={[
            { title: 'Book in 60 seconds', body: 'Pick how often, how many dogs and how the yard looks today. You see your price before you book.' },
            { title: 'We scoop on your day', body: 'We walk the yard in a grid, bag every pile and haul it away. Tools and boots are sanitized between yards.' },
            { title: 'Gate photo every visit', body: `You get a text with a photo of your latched gate. Missed a spot? Tell us within ${G} and we come back free.` },
          ]}
        />

        {/* Pricing */}
        <section id="pricing" aria-label="Pricing" style={{ background: 'var(--paper-2)' }}>
          <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="sec-intro">
              <h2 className="display h2">Simple per-visit pricing</h2>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>Per visit, for yards up to ½ acre. Charged after each visit — no contracts.</p>
            </div>

            <div className="price-table price-table-white">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dogs</th>
                    <th scope="col">Weekly</th>
                    <th scope="col">Twice weekly</th>
                    <th scope="col">Every other week</th>
                    <th scope="col">One-time yard reset</th>
                  </tr>
                </thead>
                <tbody>
                  {DOGS.map((n) => (
                    <tr key={n}>
                      <th scope="row">{dogsText(n)}</th>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><strong>${petVisit('weekly', n)}</strong>{n === 1 && <span className="tag-popular">Most popular</span>}</span></td>
                      <td><strong>${petVisit('twice', n)}</strong></td>
                      <td><strong>${petVisit('biweekly', n)}</strong></td>
                      <td><strong>${petVisit('once', n)}</strong></td>
                    </tr>
                  ))}
                  <tr className="row-note">
                    <th scope="row">{P.maxDogs + 1}+ dogs, or over ½ acre</th>
                    <td colSpan={4} style={{ color: 'var(--ink-2)' }}>Custom quote — <a className="link" href="#booking">text us for a quote</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="price-cards price-cards-always">
              {DOGS.map((n) => (
                <div key={n} className="price-card" style={{ background: '#FFFFFF' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{dogsText(n)}</span>
                    {n === 1 && <span className="tag-popular">Weekly is most popular</span>}
                  </div>
                  <div className="small" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <div className="price-cell"><span>Weekly</span><strong>${petVisit('weekly', n)}</strong></div>
                    <div className="price-cell"><span>Twice weekly</span><strong>${petVisit('twice', n)}</strong></div>
                    <div className="price-cell"><span>Every other week</span><strong>${petVisit('biweekly', n)}</strong></div>
                    <div className="price-cell"><span>One-time yard reset</span><strong>${petVisit('once', n)}</strong></div>
                  </div>
                </div>
              ))}
              <div className="small notice" style={{ borderRadius: 16 }}>
                <strong>{P.maxDogs + 1}+ dogs, or over ½ acre:</strong> custom quote — <a className="link" href="#booking">text us for a quote</a>
              </div>
            </div>

            <div className="info-card">
              <h3 className="display" style={{ fontSize: 18, lineHeight: '24px' }}>Initial yard cleanup</h3>
              <p className="body" style={{ margin: 0, color: 'var(--ink-2)' }}>
                If the yard has built up, your first visit is a longer cleanup, priced by how it looks today. After that you pay the per-visit price.
              </p>
              <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 20, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li><strong style={{ color: 'var(--ink)' }}>Kept up weekly:</strong> no cleanup charge — your first visit is the per-visit price.</li>
                <li><strong style={{ color: 'var(--ink)' }}>A few weeks behind:</strong> ${P.initialCleanupWithWeekly} with weekly or twice-weekly service (normally ${P.initialCleanup}); ${P.initialCleanup} with every other week.</li>
                <li><strong style={{ color: 'var(--ink)' }}>A month or more:</strong> ${P.initialCleanup}.</li>
                <li><strong style={{ color: 'var(--ink)' }}>One-time yard reset:</strong> ${P.oneTime} flat, any condition.</li>
              </ul>
              <p className="small" style={{ margin: '4px 0 0', color: 'var(--muted)' }}>If your first visit needs more cleanup than you picked, we’ll text you before charging the higher rate.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h3 className="display" style={{ fontSize: 18, lineHeight: '24px' }}>Add-ons</h3>
              <div className="addons">
                <div className="info-card addon">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>Yard deodorizer</span>
                    <span className="small" style={{ color: 'var(--ink-2)' }}>A pet-safe spray for patios and high-traffic spots.</span>
                  </div>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>+${P.addOns.deodorizer}<span className="small" style={{ color: 'var(--muted)', fontWeight: 400 }}> / visit</span></span>
                </div>
                <div className="info-card addon">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontWeight: 600 }}>Sanitizing spray</span>
                    <span className="small" style={{ color: 'var(--ink-2)' }}>A deeper clean for patios, runs and turf.</span>
                  </div>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>+${P.addOns.sanitizing}</span>
                </div>
              </div>
              <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>We don’t offer flea, tick or any pesticide treatments.</p>
            </div>
          </div>
        </section>

        {/* Why Fernhouse */}
        <section aria-label="Why Fernhouse" style={{ background: '#FFFFFF' }}>
          <div className="wrap sec" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <h2 className="display h2">Why book with Fernhouse</h2>
            <div className="why-grid">
              <WhyCard icon={<Shield stroke="var(--accent)" />} title="Vetted, bonded and insured pros">
                Every pro is background-checked before their first visit and carries their own bonding and liability insurance, which we verify before they’re booked.
              </WhyCard>
              <WhyCard icon={<Calendar stroke="var(--accent)" />} title="Your yard is never skipped">
                You keep the same route day. If your pro is out, a backup covers your yard.
              </WhyCard>
              <WhyCard gold icon={<Redo stroke="var(--gold-ink)" />} title="Proof every visit">
                A photo of your latched gate after every visit. Spot something we missed? Tell us within {G} and we come back free.
              </WhyCard>
              <WhyCard icon={<Camera stroke="var(--accent)" />} title="One company for your home and yard">
                Book home cleaning and yard service with the same account, and pay one company for both.{' '}
                <PickCleanLink service="standard" href="/#booking" className="link">See home cleaning</PickCleanLink>
              </WhyCard>
            </div>
          </div>
        </section>

        <ServiceAreas />

        <Faq title="Pet waste questions" items={FAQS} />

        <FinalCta
          label="Book pet waste removal"
          title="A clean yard this week."
          line={`Weekly from $${P.weekly1Dog} per visit · No contracts`}
          cta="Book yard cleanup"
        />
      </main>

      <SiteFooter variant="pet" />
      <div className="mbar-space" aria-hidden="true" />
    </div>
  );
}
