import { BRAND } from '@/lib/config';
import { Check, ImageIcon, Paw, PhoneIcon } from './Icons';

export function HeroActions() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <a className="btn btn-primary btn-block-m" href="#booking">See my price</a>
      <a className="btn btn-secondary btn-block-m" href={BRAND.phoneHref}>
        <PhoneIcon size={20} />
        Call {BRAND.phone}
      </a>
    </div>
  );
}

export function HeroChips({ items }: { items: string[] }) {
  return (
    <ul aria-label="Why customers book" className="chips">
      {items.map((t) => (
        <li key={t} className="small chip">
          <Check size={16} stroke="var(--accent)" />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** Stand-in until the owner supplies a yard photo. Never presented as a Fernhouse pro. */
export function YardPhotoPlaceholder({ label, icon }: { label: string; icon: 'paw' | 'image' }) {
  const Icon = icon === 'paw' ? Paw : ImageIcon;
  return (
    <div className="a-photo photo-placeholder" role="img" aria-label={`Photo placeholder: ${label.toLowerCase()}`}>
      <Icon size={40} stroke="var(--muted)" />
      <span className="small" style={{ color: 'var(--muted)', fontWeight: 600, maxWidth: 320 }}>Yard photo — {label}</span>
    </div>
  );
}
