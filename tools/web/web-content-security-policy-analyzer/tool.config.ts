import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-content-security-policy-analyzer-v1',
  name: 'CSP Header Analyzer',
  slug: 'web-content-security-policy-analyzer',
  description:
    'Parse a Content-Security-Policy header and flag weak or unsafe directives.',
  category: 'web',
  tags: ['csp', 'security', 'header', 'http', 'analyzer'],
  keywords: [
    'content-security-policy',
    'csp',
    'unsafe-inline',
    'unsafe-eval',
    'security header',
    'xss',
    'directives',
  ],
  icon: 'Shield',
  relatedTools: [],
};

export default meta;
