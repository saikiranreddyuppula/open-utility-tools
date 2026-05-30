import type { MetadataRoute } from 'next';

import { TOOLS, CATEGORIES } from '@/lib/registry';
import { SITE_URL } from '@/lib/seo/site';

// Required for output:'export' — without it the static export build errors out
// (route is treated as dynamic). Emits a real out/sitemap.xml at build time.
export const dynamic = 'force-static';

/**
 * One entry per indexable URL: home, the 12 category hubs, and every visible
 * tool. Hidden/deferred tools and the personal /favorites,/recent,/offline
 * pages are intentionally excluded. URLs use the canonical https + www +
 * trailing-slash form (trailingSlash:true) to agree with rel=canonical.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    ...CATEGORIES.map((id) => ({
      url: `${SITE_URL}/categories/${id}/`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...TOOLS.map((tool) => ({
      url: `${SITE_URL}/tools/${tool.slug}/`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
