import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-robots-txt-tester-v1',
  name: 'robots.txt Tester',
  slug: 'web-robots-txt-tester',
  description:
    'Test whether a URL path is allowed for a user-agent against pasted robots.txt rules.',
  category: 'web',
  tags: ['robots', 'seo', 'crawler', 'allow', 'disallow'],
  keywords: ['robots.txt', 'user-agent', 'googlebot', 'rfc 9309', 'crawl-delay', 'sitemap'],
  icon: 'Bug',
  relatedTools: [],
};

export default meta;
