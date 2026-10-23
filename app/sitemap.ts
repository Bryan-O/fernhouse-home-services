import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';

export default function sitemap(): MetadataRoute.Sitemap {
  return ['', '/pet-waste-removal', '/book', '/manage', '/privacy', '/terms'].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === '' || path === '/pet-waste-removal' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/pet-waste-removal' ? 0.9 : 0.5,
  }));
}
