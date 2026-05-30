import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-permissions-policy-builder-v1',
  name: 'Permissions-Policy Builder',
  slug: 'web-permissions-policy-builder',
  description:
    'Build a Permissions-Policy (Feature-Policy) header from per-feature allowlists.',
  category: 'web',
  tags: ['security', 'headers', 'permissions-policy', 'feature-policy'],
  keywords: [
    'permissions-policy',
    'feature-policy',
    'header',
    'allowlist',
    'camera',
    'microphone',
    'geolocation',
    'security',
  ],
  icon: 'SlidersHorizontal',
  relatedTools: [],
};

export default meta;
