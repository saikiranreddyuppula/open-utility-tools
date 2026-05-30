import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-htaccess-snippet-v1',
  name: 'Apache .htaccess Snippet Generator',
  slug: 'web-htaccess-snippet',
  description:
    'Generate .htaccess rules for redirects, HTTPS, rewrites, headers, and caching.',
  category: 'web',
  tags: ['htaccess', 'apache', 'headers', 'caching', 'rewrite'],
  keywords: [
    'htaccess',
    'apache',
    'mod_rewrite',
    'mod_headers',
    'mod_expires',
    'cache-control',
    'security headers',
    'csp',
    'https',
  ],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
