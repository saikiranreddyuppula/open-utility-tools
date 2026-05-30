import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/seo/site';

// Required for output:'export' — emits a real out/robots.txt at build time.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // User-state pages with no SEO value (and they 404 without client JS).
      disallow: ['/favorites/', '/recent/', '/offline/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
