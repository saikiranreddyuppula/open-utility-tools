import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-content-security-policy-linter-v1',
  name: 'Content-Security-Policy Linter',
  slug: 'web-content-security-policy-linter',
  description:
    'Parses a CSP header string and flags unsafe or redundant directives.',
  category: 'web',
  tags: ['csp', 'lint', 'security', 'header', 'http'],
  keywords: [
    'content-security-policy',
    'csp linter',
    'duplicate sources',
    'unknown directive',
    'unsafe-inline',
    'redundant',
    'normalize',
  ],
  icon: 'Shield',
  relatedTools: [],
};

export default meta;
