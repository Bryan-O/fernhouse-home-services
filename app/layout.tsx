import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { BRAND, SITE_URL } from '@/lib/config';
import './globals.css';

// Self-hosted (Fontsource), so pages never call Google Fonts.
const inter = localFont({
  src: [
    { path: '../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', weight: '400' },
    { path: '../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', weight: '600' },
  ],
  variable: '--font-inter',
  display: 'swap',
});
const jakarta = localFont({
  src: [
    { path: '../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2', weight: '700' },
    { path: '../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2', weight: '800' },
  ],
  variable: '--font-jakarta',
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
  themeColor: '#0E7A5F',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
