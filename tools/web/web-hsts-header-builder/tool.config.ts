import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-hsts-header-builder-v1',
  name: 'HSTS Header Builder',
  slug: 'web-hsts-header-builder',
  description:
    'Build and decode the Strict-Transport-Security header with preload-eligibility checks.',
  category: 'web',
  tags: ['hsts', 'http', 'security', 'headers', 'preload', 'https'],
  keywords: [
    'strict-transport-security',
    'hsts',
    'max-age',
    'includeSubDomains',
    'preload',
    'hstspreload',
    'https',
    'security header',
  ],
  icon: 'Lock',
  relatedTools: [],
};

export default meta;
