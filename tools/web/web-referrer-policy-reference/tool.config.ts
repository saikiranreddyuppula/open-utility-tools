import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-referrer-policy-reference-v1',
  name: 'Referrer-Policy Reference & Tester',
  slug: 'web-referrer-policy-reference',
  description:
    'Explain Referrer-Policy values and simulate what Referer is sent between two URLs.',
  category: 'web',
  tags: ['referrer', 'policy', 'http', 'privacy', 'security'],
  keywords: [
    'referrer-policy',
    'referer header',
    'no-referrer',
    'strict-origin',
    'cross-origin',
    'downgrade',
    'privacy',
  ],
  icon: 'Eye',
  relatedTools: [],
};

export default meta;
