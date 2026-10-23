import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { AUTOMATIONS, BRAND, LEGAL, OFFER, POLICIES } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The terms that apply when you book with ${BRAND.name}.`,
};

const TOC = [
  ['#t-booking', 'Booking and payment'], ['#t-prices', 'Prices'], ['#t-offer', 'First-clean offer'], ['#t-recurring', 'Recurring plans'],
  ['#t-cancel', 'Cancellations'], ['#t-guarantee', 'Re-clean guarantee'], ['#t-pet', 'Pet waste removal'], ['#t-access', 'Access, safety and pets'],
  ['#t-damage', 'Damage and claims'], ['#t-solicit', 'Hiring your team directly'], ['#t-legal', 'Liability and law'], ['#t-texts', 'Text messages'],
  ['#t-contact', 'Changes and contact'],
] as const;

export default function TermsPage() {
  const H = POLICIES.freeChangeHours;
  const G = POLICIES.guaranteeHours;
  const email = <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>;
  const phone = <a href={BRAND.phoneHref}>{BRAND.phone}</a>;
  return (
    <LegalPage title="Terms of Service" updated={LEGAL.termsUpdated} toc={TOC}>
      <p>These terms apply when you book a cleaning with {BRAND.name} through our website or by phone. By booking, you agree to them. Please read them — they’re written to be short and plain.</p>

      <h2 id="t-booking">Booking and payment</h2>
      <ul>
        <li>You book and pay {BRAND.name} online through our secure checkout, powered by Stripe. You pay {BRAND.name}, never your cleaner directly.</li>
        <li>Your first visit is charged when you book. For recurring plans, each later visit is charged to your card on file on the day of the visit.</li>
        <li>Prices include all supplies and equipment. There are no hidden fees.</li>
      </ul>

      <h2 id="t-prices">Prices</h2>
      <p>Our prices are starting prices based on the bedrooms and bathrooms you choose, for a home in normal condition. If your home is much larger than booked, or needs far more work than a typical clean, your team will contact us before starting. We’ll call you to agree on an adjusted price or reschedule — we never add charges without asking.</p>

      <h2 id="t-offer">First-clean offer</h2>
      <p>New customers get {OFFER.firstCleanPct}% off their first booking. One offer per household. It can’t be combined with other offers or exchanged for cash.</p>

      <h2 id="t-recurring">Recurring plans</h2>
      <p>Weekly and biweekly plans have no contract. You can pause, reschedule or cancel your plan anytime from your confirmation link, subject to the {H}-hour rule below.</p>

      <h2 id="t-cancel">Cancellations and rescheduling</h2>
      <ul>
        <li>Reschedule or cancel <strong>free</strong> up to {H} hours before your visit.</li>
        <li>Changes made inside {H} hours carry a <strong>${POLICIES.lateCancelFee}</strong> late-cancellation fee, because your team has already been scheduled.</li>
        <li>If your team arrives during your window and can’t get in, the visit counts as a late cancellation.</li>
        <li>If we ever need to reschedule your visit, there’s no charge, and we’ll offer you the nearest open slot.</li>
      </ul>

      <h2 id="t-guarantee">Re-clean guarantee</h2>
      <p>If anything we cleaned isn’t right, tell us within <strong>{G} hours</strong> of your visit — photos help. We’ll send a team back to re-clean those areas, free. If a re-clean doesn’t fix the problem, we’ll work with you on a fair refund.</p>

      <h2 id="t-pet">Pet waste removal</h2>
      <ul>
        <li>We visit on your chosen route day and check the whole yard. Waste is bagged and hauled away.</li>
        <li>Each visit is charged to your card on file after it’s done. If waste has built up, your first visit is an initial yard cleanup, priced by the yard condition you pick when you book; after that you pay the per-visit price.</li>
        <li><strong>Yard condition:</strong> we rely on the condition you pick. If your yard needs more cleanup than you picked, we’ll text you before your first visit is charged at the higher rate, and you can cancel instead without a fee.</li>
        <li>Please give us gate access — a code, a note, or an unlocked gate. If we can’t get in or a dog makes the yard unsafe to enter, we’ll text you and arrange another time; a missed visit due to no access is charged as a late cancellation.</li>
        <li><strong>Re-scoop guarantee:</strong> if we missed something, tell us within {G} hours of your visit and we’ll come back free.</li>
        <li>We don’t offer flea, tick or any pesticide treatments.</li>
      </ul>

      <h2 id="t-access">Access, safety and pets</h2>
      <ul>
        <li>Please give us accurate access instructions and make sure your team can get in during your arrival window.</li>
        <li>Let us know about pets when you book, and secure any pet that may not be comfortable around visitors.</li>
        <li>Please put away cash, jewelry and other valuables before your visit.</li>
        <li>Your team may skip any task they consider unsafe, such as work at heights beyond a step stool, moving heavy furniture, or cleaning bodily fluids, mold or pest waste.</li>
      </ul>

      <h2 id="t-damage">Damage and claims</h2>
      <p>Every pro we send carries their own bond and liability insurance, which we verify before they’re booked. If something is damaged during a visit, tell us within {LEGAL.damageReportHours} hours with photos. We’ll handle the claim with you and the pro’s insurer, and work to get it repaired, replaced or reimbursed. We aren’t responsible for normal wear, pre-existing damage, or items that were improperly installed or secured.</p>

      <h2 id="t-solicit">Hiring your team directly</h2>
      <p>Our guarantees, backup coverage and insurance apply only to cleanings booked through {BRAND.name}. During your service and for {LEGAL.directHireMonths} months after your last visit, you agree not to hire any member of a team {BRAND.name} sends to your home for cleaning outside of {BRAND.name}. If you do, a ${LEGAL.directHireFee.toLocaleString('en-US')} placement fee applies.</p>

      <h2 id="t-legal">Liability and governing law</h2>
      <p>To the extent the law allows, {BRAND.name}’s total liability for any claim related to a cleaning is limited to the amount you paid for that cleaning, except for damage covered under the section above. These terms are governed by the laws of the State of {LEGAL.governingState}.</p>

      <h2 id="t-texts">Text messages</h2>
      <ul>
        <li><strong>{BRAND.name} booking texts:</strong> when you book or request a quote, we text you about it — confirmations, reminders, arrival and visit updates, gate photos and receipts. Marketing texts are sent only if you opt in separately, up to {AUTOMATIONS.marketingTextsPerMonthMax} a month.</li>
        <li>Message frequency varies. Message and data rates may apply.</li>
        <li>Reply <strong>STOP</strong> to cancel at any time; we’ll send one message confirming you’re unsubscribed. Reply <strong>START</strong> to resume. Reply <strong>HELP</strong> for help, or contact us at {BRAND.phone} or {BRAND.email}.</li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
        <li>See our <Link href="/privacy">Privacy Policy</Link> for how we handle your number.</li>
      </ul>

      <h2 id="t-contact">Changes and contact</h2>
      <p>If we update these terms, we’ll change the date at the top of this page. The version in effect when you book applies to that booking. Questions? Email {email} or call {phone}. See also our <Link href="/privacy">Privacy Policy</Link>.</p>
    </LegalPage>
  );
}
