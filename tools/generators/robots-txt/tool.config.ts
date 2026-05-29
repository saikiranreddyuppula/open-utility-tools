import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-robots-txt-v1',
  name: 'robots.txt Generator',
  slug: 'robots-txt',
  description: 'Build a robots.txt with allow/disallow rules and a sitemap line.',
  category: 'generators',
  tags: ['robots.txt', 'seo', 'crawler', 'sitemap'],
  keywords: ['robots.txt', 'robots generator', 'crawler rules', 'disallow', 'sitemap'],
  icon: 'FileCog',
  relatedTools: ['meta-tags', 'gitignore-generator', 'slugify'],
};

export default meta;
