import type { NextConfig } from 'next';

// Security headers on every response. Manage links (/b/…) and pro job links (/job/…) carry
// private tokens in the address, so those pages send no Referer at all to other sites.
const common = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [...common, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }] },
      { source: '/b/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/job/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Robots-Tag', value: 'noindex' }] },
      { source: '/book/confirmed', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    ];
  },
};

export default nextConfig;
