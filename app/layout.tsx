import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { BRAND, SITE_URL } from '@/lib/config';
import { Analytics } from '@/components/Analytics';
import './globals.css';

// Self-hosted (Fontsource), so pages never call Google Fonts. Brand system: Newsreader for
// headings, DM Sans for text and the wordmark.
const dmSans = localFont({
  src: [
    { path: '../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2', weight: '400' },
    { path: '../node_modules/@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2', weight: '600' },
    { path: '../node_modules/@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2', weight: '700' },
  ],
  variable: '--font-dm-sans',
  display: 'swap',
});
const newsreader = localFont({
  src: [{ path: '../node_modules/@fontsource/newsreader/files/newsreader-latin-600-normal.woff2', weight: '600' }],
  variable: '--font-newsreader',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name} — House Cleaning in ${BRAND.region}`, template: `%s | ${BRAND.name}` },
  description: `House cleaning and pet waste removal in ${BRAND.areaLine}. Book online.`,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#243E36',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${newsreader.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
