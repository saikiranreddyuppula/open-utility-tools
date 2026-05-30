import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-patch-diff-v1',
  name: 'JSON Patch Generator',
  slug: 'json-patch-diff',
  description: 'Generate an RFC 6902 JSON Patch between two JSON documents.',
  category: 'data',
  tags: ['json', 'patch', 'diff', 'rfc6902', 'json-pointer'],
  keywords: ['json patch', 'json diff', 'rfc 6902', 'generate patch', 'compare json'],
  icon: 'Diff',
  relatedTools: [],
};

export default meta;
