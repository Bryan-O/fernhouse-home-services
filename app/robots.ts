import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

// Private pages (owner dashboard, manage and job links, the confirmation page) stay out of search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/b/', '/job/', '/book/confirmed', '/api/'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
