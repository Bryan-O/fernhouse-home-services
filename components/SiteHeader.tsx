'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BrandMark } from './BrandMark';
import { ChevronDown, MenuIcon, PhoneIcon } from './Icons';
import { BRAND, type CleanService } from '@/lib/config';
import { pickClean } from '@/lib/booking-store';

type Variant = 'home' | 'pet' | 'legal' | 'minimal';

const CLEAN_ITEMS: { service: CleanService; label: string; sub: string }[] = [
  { service: 'standard', label: 'Residential Cleaning', sub: 'Recurring upkeep, weekly or biweekly' },
  { service: 'deep', label: 'Deep Cleaning', sub: 'A full top-to-bottom reset' },
  { service: 'move', label: 'Move-In/Out Cleaning', sub: 'Empty-home detail clean' },
];

function CallButton() {
  return (
    <a className="btn btn-secondary btn-sm" href={BRAND.phoneHref} aria-label={`Call ${BRAND.phone}`} style={{ padding: '0 14px' }}>
      <PhoneIcon size={18} />
      <span className="call-label">{BRAND.phone}</span>
    </a>
  );
}

/** Sticky site header. Home and pet pages get the Services menu; legal and 404 get a lighter header. */
export function SiteHeader({ variant }: { variant: Variant }) {
  const [ddOpen, setDdOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mSvcOpen, setMSvcOpen] = useState(false);

  const onHome = variant === 'home';
  const onPet = variant === 'pet';
  // Anchors on this page, or on the home page from elsewhere.
  const homeAnchor = (id: string) => (onHome ? `#${id}` : `/#${id}`);
  const localAnchor = (id: string) => (onHome || onPet ? `#${id}` : `/#${id}`);
  const cleanHref = homeAnchor('booking');

  const choose = (service: CleanService) => () => {
    pickClean({ service });
    setDdOpen(false);
    setMenuOpen(false);
  };
  const hoverable = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  if (variant === 'minimal' || variant === 'legal') {
    const minimal = variant === 'minimal';
    return (
      <header style={{ position: minimal ? 'static' : 'sticky', top: 0, zIndex: 20, background: minimal ? '#FFFFFF' : 'rgba(255,255,255,0.96)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 68 }}>
          <Link href="/" aria-label={`${BRAND.name} home`} className="brand-link">
            <BrandMark />
          </Link>
          {variant === 'legal' && (
            <nav className="nav-links" aria-label="Main">
              <Link href="/#services">Services</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/#how">How it works</Link>
              <Link href="/#faq">FAQ</Link>
            </nav>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CallButton />
            <Link className="btn btn-primary btn-sm hdr-book" href={minimal ? '/#booking' : '/book'}>Book now</Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.96)', borderBottom: '1px solid var(--line)' }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 68 }}>
        <Link href={onHome ? '#top' : '/'} aria-label={`${BRAND.name} home`} className="brand-link">
          <BrandMark />
        </Link>

        <nav className="nav-links" aria-label="Main">
          <div
            className="dd"
            onMouseEnter={() => hoverable() && setDdOpen(true)}
            onMouseLeave={() => hoverable() && setDdOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDdOpen(false);
                document.getElementById('svc-btn')?.focus();
              }
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDdOpen(false);
            }}
          >
            <button type="button" id="svc-btn" className="dd-btn" aria-expanded={ddOpen} aria-controls="svc-menu" onClick={() => setDdOpen(!ddOpen)}>
              Services
              <ChevronDown size={16} width={2} className={ddOpen ? 'chev open' : 'chev'} />
            </button>
            {ddOpen && (
              <div id="svc-menu" className="dd-menu">
                {CLEAN_ITEMS.map((it) => (
                  <a key={it.service} className="dd-item" href={cleanHref} onClick={choose(it.service)}>
                    {it.label}
                    <small>{it.sub}</small>
                  </a>
                ))}
                <div className="dd-sep" aria-hidden="true" />
                <Link className="dd-item" href={onPet ? '#top' : '/pet-waste-removal'} aria-current={onPet ? 'page' : undefined}>
                  Pet Waste Removal
                  <small>Weekly yard service</small>
                </Link>
              </div>
            )}
          </div>
          <a href={localAnchor('pricing')}>Pricing</a>
          <a href={localAnchor('how')}>How it works</a>
          <a href={localAnchor('faq')}>FAQ</a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm menu-btn"
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="m-menu"
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ width: 44, padding: 0 }}
          >
            <MenuIcon size={20} width={1.8} />
          </button>
          <CallButton />
          {onHome ? (
            <a className="btn btn-primary btn-sm hdr-book" href="#booking" onClick={() => pickClean()}>Book now</a>
          ) : (
            <a className="btn btn-primary btn-sm hdr-book" href="#booking">Book now</a>
          )}
        </div>
      </div>

      {menuOpen && (
        <nav id="m-menu" className="mmenu" aria-label="Menu">
          <div className="wrap" style={{ paddingTop: 4, paddingBottom: 12 }}>
            <button type="button" className="m-row" aria-expanded={mSvcOpen} aria-controls="m-svc" onClick={() => setMSvcOpen(!mSvcOpen)}>
              Services
              <ChevronDown size={20} className={mSvcOpen ? 'chev open' : 'chev'} />
            </button>
            {mSvcOpen && (
              <div id="m-svc">
                {CLEAN_ITEMS.map((it) => (
                  <a key={it.service} className="m-sub" href={cleanHref} onClick={choose(it.service)}>{it.label}</a>
                ))}
                <Link
                  className="m-sub m-sub-sep"
                  href={onPet ? '#top' : '/pet-waste-removal'}
                  aria-current={onPet ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  Pet Waste Removal
                </Link>
              </div>
            )}
            <a className="m-row" href={localAnchor('pricing')} onClick={() => setMenuOpen(false)}>Pricing</a>
            <a className="m-row" href={localAnchor('how')} onClick={() => setMenuOpen(false)}>How it works</a>
            <a className="m-row" href={localAnchor('faq')} onClick={() => setMenuOpen(false)} style={{ borderBottom: 0 }}>FAQ</a>
          </div>
        </nav>
      )}
    </header>
  );
}
