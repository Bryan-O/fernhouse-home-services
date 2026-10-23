'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { BookingCard } from './booking/BookingCard';
import { HeroActions, HeroChips, YardPhotoPlaceholder } from './HeroBits';
import { MobileBookBar } from './MobileBookBar';
import {
  DEFAULT_CLEAN,
  DEFAULT_PET_STEP1,
  PICK_CLEAN_EVENT,
  readClean,
  readPet,
  writeClean,
  writePet,
  writeServiceTab,
  type CleanStep1,
  type PetStep1,
  type ServiceTab,
} from '@/lib/booking-store';
import { PET_WASTE_PRICING, popularHome } from '@/lib/config';

const HERO_SUB: Record<ServiceTab, string> = {
  clean: 'Atlanta’s easiest way to keep a clean home — vetted, background-checked pros, a re-clean guarantee, and booking that takes less time than reading this page.',
  pet: 'Weekly dog waste removal for Atlanta homes. We scoop, haul it away, and text you a photo of your latched gate — you never need to be home.',
};

/** Home page hero: copy, photo and the two-tab booking card (Home Cleaning / Pet Waste). */
export function HomeHero() {
  const [tab, setTab] = useState<ServiceTab>('clean');
  const [clean, setClean] = useState<CleanStep1>(DEFAULT_CLEAN);
  const [pet, setPet] = useState<PetStep1>(DEFAULT_PET_STEP1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore Step 1 choices; arriving with ?service=pet-waste opens the Pet Waste tab.
    const c = readClean();
    if (c) setClean(c);
    const p = readPet();
    if (p) setPet(p);
    if (new URLSearchParams(window.location.search).get('service') === 'pet-waste') setTab('pet');
    setReady(true);
    const onPick = (e: Event) => {
      setTab('clean');
      setClean((prev) => ({ ...prev, ...(e as CustomEvent<Partial<CleanStep1>>).detail }));
    };
    window.addEventListener(PICK_CLEAN_EVENT, onPick);
    return () => window.removeEventListener(PICK_CLEAN_EVENT, onPick);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeClean(clean);
    writePet(pet);
    writeServiceTab(tab);
  }, [ready, clean, pet, tab]);

  const anchor = popularHome();
  return (
    <section id="hero" aria-label="Book a cleaning" style={{ background: 'var(--paper-2)' }}>
      <div className="wrap sec hero-grid">
        <div className="a-copy hero-copy">
          <h1 className="display h1" style={{ maxWidth: 560 }}>Book a vetted pro online in 60 seconds.</h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)', maxWidth: '65ch' }}>{HERO_SUB[tab]}</p>
          <HeroActions />
          <HeroChips items={['No contracts', 'Re-clean guarantee', 'Background-checked pros', 'Bonded & insured']} />
        </div>

        {tab === 'clean' ? (
          <Image
            className="a-photo hero-photo"
            src="/img/hero.webp"
            width={1600}
            height={1067}
            priority
            sizes="(max-width: 1023px) 100vw, 560px"
            alt="Gloved hands vacuuming a gray upholstered cushion in a bright living room"
          />
        ) : (
          // TODO (owner): yard photo — clean fenced backyard or a dog on fresh grass.
          <YardPhotoPlaceholder label="clean fenced backyard or a dog on fresh grass" icon="paw" />
        )}

        <BookingCard tab={tab} onTab={setTab} clean={clean} setClean={setClean} pet={pet} setPet={setPet} />
      </div>
      <MobileBookBar
        text={tab === 'pet' ? `Yard cleanup from $${PET_WASTE_PRICING.weekly1Dog}/visit` : `${anchor.bd}-bed biweekly from $${anchor.standard}`}
      />
    </section>
  );
}
