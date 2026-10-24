import { BRAND } from '@/lib/config';

/** The house-in-a-square mark and wordmark from the design header. */
export function BrandMark() {
  return (
    <>
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11l8-6.5 8 6.5" />
          <path d="M6 9.5V19h12V9.5" />
        </svg>
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em' }}>{BRAND.name}</span>
    </>
  );
}
