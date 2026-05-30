import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-status-code-explainer-v1',
  name: 'HTTP Status Code Explainer',
  slug: 'web-status-code-explainer',
  description:
    'Look up a status code or symbol to get its class, meaning, and typical use.',
  category: 'web',
  tags: ['http', 'status', 'reference', 'rest', 'codes'],
  keywords: [
    'http status code',
    '404',
    '500',
    'reason phrase',
    'status class',
    'too many requests',
    'express res.status',
    'status line',
  ],
  icon: 'Activity',
  relatedTools: [],
};

export default meta;
