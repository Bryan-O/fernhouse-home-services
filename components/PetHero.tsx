'use client';

import { useEffect, useState } from 'react';
import { BookingCard } from './booking/BookingCard';
import { HeroActions, HeroChips, YardPhotoPlaceholder } from './HeroBits';
import { MobileBookBar } from './MobileBookBar';
import { Paw } from './Icons';
import { DEFAULT_CLEAN, DEFAULT_PET_STEP1, readPet, writePet, writeServiceTab, type PetStep1 } from '@/lib/booking-store';
import { PET_WASTE_PRICING } from '@/lib/config';

/** Pet waste page hero: the booking card locked to Pet Waste. */
export function PetHero() {
  const [pet, setPet] = useState<PetStep1>(DEFAULT_PET_STEP1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = readPet();
    if (p) setPet(p);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writePet(pet);
    writeServiceTab('pet');
  }, [ready, pet]);

  return (
    <section id="hero" aria-labelledby="pet-hero-h" style={{ background: 'var(--paper-2)' }}>
      <div className="wrap sec hero-grid">
        <div className="a-copy hero-copy">
          <span className="small kicker"><Paw size={16} stroke="var(--accent)" />Pet Waste Removal</span>
          <h1 id="pet-hero-h" className="display h1" style={{ maxWidth: 560 }}>Your yard, scooped weekly. You never touch it.</h1>
          <p className="body" style={{ margin: 0, color: 'var(--ink-2)', maxWidth: '65ch' }}>
            Weekly dog waste removal for Atlanta homes. We scoop, haul it away, and text you a photo of your latched gate — you never need to be home.
          </p>
          <HeroActions />
          <HeroChips items={['No contracts', 'Background-checked & insured', 'Gate photo every visit', 'Re-scoop guarantee']} />
        </div>

        {/* TODO (owner): yard photo — clean fenced backyard or a latched gate. */}
        <YardPhotoPlaceholder label="clean fenced backyard with a latched gate" icon="image" />

        <BookingCard tab="pet" clean={DEFAULT_CLEAN} setClean={() => {}} pet={pet} setPet={setPet} locked />
      </div>
      <MobileBookBar text={`Yard cleanup from $${PET_WASTE_PRICING.weekly1Dog}/visit`} />
    </section>
  );
}
