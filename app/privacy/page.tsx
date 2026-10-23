import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { AUTOMATIONS, BRAND, LEGAL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${BRAND.name} collects, uses and protects your information.`,
};

const TOC = [
  ['#p-collect', 'Information we collect'], ['#p-use', 'How we use it'], ['#p-texts', 'Text messages'],
  ['#p-cookies', 'Cookies and analytics'], ['#p-share', 'How we share it'], ['#p-keep', 'How long we keep it'],
  ['#p-security', 'Security'], ['#p-choices', 'Your choices'], ['#p-children', 'Children'], ['#p-contact', 'Changes and contact'],
] as const;

export default function PrivacyPage() {
  const email = <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>;
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL.privacyUpdated} toc={TOC}>
      <p>This policy explains what information {BRAND.name} collects when you visit our website or book a cleaning, how we use it, and the choices you have. {BRAND.name} provides house cleaning and pet waste removal in Atlanta, Georgia and surrounding suburbs.</p>

      <h2 id="p-collect">Information we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li>Your name, mobile phone number and email address.</li>
        <li>Your home’s address, ZIP code, size, and any access instructions, pet notes or special requests you add.</li>
        <li>Messages you send us, and your feedback after a clean.</li>
      </ul>
      <h3>Payment information</h3>
      <p>Payments are processed by Stripe. Your card number goes directly to Stripe — {BRAND.name} never sees or stores it. We receive a confirmation of payment and the last four digits of your card.</p>
      <h3>Information collected automatically</h3>
      <p>When you visit our site we collect basic device and usage information (such as browser type, pages viewed and referring site), and the advertising details in the link you arrived from (such as campaign tags and click identifiers from Facebook, Instagram or Google).</p>

      <h2 id="p-use">How we use your information</h2>
      <ul>
        <li>To schedule, complete and support your cleanings, including recurring plans.</li>
        <li>To give your assigned cleaning team the details they need for your visit — your address, access instructions, pets and preferences.</li>
        <li>To send booking confirmations, reminders and updates by text and email.</li>
        <li>To process payments, refunds and re-cleans.</li>
        <li>To understand which ads and pages work, improve our service, and prevent fraud.</li>
        <li>To meet legal, tax and accounting obligations.</li>
      </ul>

      <h2 id="p-texts">Text messages</h2>
      <p>When you book or ask for a quote, you agree to get texts from {BRAND.name} about that booking or quote: confirmations, reminders, arrival and visit updates (including gate photos for yard service), and receipts. Message frequency varies. We send marketing texts — no more than {AUTOMATIONS.marketingTextsPerMonthMax} a month — only if you tick the separate, optional box to receive them. Message and data rates may apply. Reply <strong>STOP</strong> to stop texts at any time, or <strong>HELP</strong> for help.</p>
      <p><strong>We don’t share your mobile number or text-message consent with anyone for their own marketing.</strong> Mobile information is never sold or shared with third parties or affiliates for marketing or promotional purposes. We share it only with the texting provider that delivers our messages.</p>

      <h2 id="p-cookies">Cookies and analytics</h2>
      <p>We use cookies and similar tools from Google Analytics and the Meta Pixel to measure site traffic and the results of our ads. You can limit this through your browser’s cookie settings, the <a href="https://tools.google.com/dlpage/gaoptout">Google Analytics opt-out add-on</a>, and your <a href="https://www.facebook.com/adpreferences">Meta ad preferences</a>.</p>

      <h2 id="p-share">How we share information</h2>
      <p><strong>We do not sell your personal information.</strong> We share it only:</p>
      <ul>
        <li>With your assigned cleaning team, limited to what they need to clean your home.</li>
        <li>With companies that help us run {BRAND.name} — payments (Stripe), text messaging, email, website hosting and analytics — under agreements that limit their use of it.</li>
        <li>When required by law, or to protect the safety and rights of our customers, our team or the public.</li>
      </ul>

      <h2 id="p-keep">How long we keep it</h2>
      <p>We keep booking records while you’re a customer and for as long as tax and accounting rules require. Access instructions, such as door and garage codes, are removed from our systems when you end your service.</p>

      <h2 id="p-security">Security</h2>
      <p>We use reasonable safeguards to protect your information. Access instructions are visible only to the team assigned to your visit. No system is perfectly secure, so please tell us right away if you think your information has been misused.</p>

      <h2 id="p-choices">Your choices</h2>
      <p>You can ask us to show, correct or delete the personal information we hold about you by emailing {email}. You can unsubscribe from marketing emails with the link in any email.</p>

      <h2 id="p-children">Children</h2>
      <p>Our website and services are for adults. We don’t knowingly collect information from children under {LEGAL.minAge}.</p>

      <h2 id="p-contact">Changes and contact</h2>
      <p>If we change this policy, we’ll update the date at the top of this page. Questions? Email {email} or call <a href={BRAND.phoneHref}>{BRAND.phone}</a>.</p>
    </LegalPage>
  );
}
