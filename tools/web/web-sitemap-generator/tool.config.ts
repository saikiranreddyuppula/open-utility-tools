import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-sitemap-generator-v1',
  name: 'XML Sitemap Generator',
  slug: 'web-sitemap-generator',
  description:
    'Turn a list of URLs into a valid sitemap.xml with lastmod, changefreq, priority.',
  category: 'web',
  tags: ['sitemap', 'xml', 'seo', 'urls', 'crawl'],
  keywords: [
    'sitemap.xml',
    'urlset',
    'changefreq',
    'lastmod',
    'priority',
    'search engine',
    'google',
    'robots',
  ],
  icon: 'Network',
  relatedTools: [],
};

export default meta;
