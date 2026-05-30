import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-csp-builder-v1',
  name: 'Content-Security-Policy Builder',
  slug: 'web-csp-builder',
  description:
    'Build a CSP header from per-directive source lists with keyword and nonce/hash helpers.',
  category: 'web',
  tags: ['http', 'csp', 'security', 'headers', 'policy'],
  keywords: [
    'content-security-policy',
    'csp',
    'script-src',
    'nonce',
    'strict-dynamic',
    'unsafe-inline',
    'header',
  ],
  icon: 'ShieldCheck',
  relatedTools: [],
};

export default meta;
