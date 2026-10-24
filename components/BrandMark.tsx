import { BRAND } from '@/lib/config';

/** The Fernhouse architectural monogram (roof over an F-H) from the brand style guide. */
export function Monogram({ size = 30, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return (
    <svg aria-hidden="true" width={Math.round(size * 0.92)} height={size} viewBox="12 12 176 191" fill={color} style={{ flex: 'none', display: 'block' }}>
      <path d="M100 15 L15 90 L30 102 L100 37 L170 102 L185 90 Z" />
      <path d="M50 85 L50 200 L75 200 L75 145 L125 145 L125 200 L150 200 L150 85 L125 85 L125 120 L75 120 L75 85 Z" />
      <path d="M75 145 L115 145 L100 132 Z" />
    </svg>
  );
}

/** Monogram + FERNHOUSE wordmark. `light` is for dark backgrounds (footer, owner header). */
export function BrandMark({ light = false, sub }: { light?: boolean; sub?: string }) {
  return (
    <>
      <Monogram color={light ? 'var(--paper)' : 'var(--accent)'} />
      <span className="wordmark" style={{ color: light ? '#FFFFFF' : 'var(--ink)' }}>
        {BRAND.name}
        {sub && <span className="wordmark-sub"> {sub}</span>}
      </span>
    </>
  );
}
