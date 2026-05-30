import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-htaccess-redirect-builder-v1',
  name: '.htaccess Redirect Builder',
  slug: 'web-htaccess-redirect-builder',
  description:
    'Build Apache .htaccess redirect rules (Redirect, RewriteRule) from source/target URL pairs with status codes.',
  category: 'web',
  tags: ['htaccess', 'apache', 'redirect', 'rewrite', 'seo'],
  keywords: [
    'htaccess',
    'apache',
    'redirect',
    'rewriterule',
    '301',
    '302',
    'mod_rewrite',
    'canonical',
    'https',
  ],
  icon: 'Route',
  relatedTools: [],
};

export default meta;
