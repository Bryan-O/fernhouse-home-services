import Image from 'next/image';
import { BRAND } from '@/lib/config';
import { Check, PhoneIcon } from './Icons';

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

/** The yard photo for the pet waste hero (home page Pet Waste tab and /pet-waste-removal). */
export function YardPhoto({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      className="a-photo hero-photo"
      src="/img/yard.webp"
      width={1600}
      height={1061}
      priority={priority}
      sizes="(max-width: 1023px) 100vw, 560px"
      alt="A golden retriever sitting on a freshly mowed backyard lawn, with friends relaxing on the grass behind"
    />
  );
}
