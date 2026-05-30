import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-deep-clean-v1',
  name: 'JSON Deep Clean',
  slug: 'json-deep-clean',
  description: 'Recursively strip null, empty, or falsy values from JSON.',
  category: 'data',
  tags: ['json', 'clean', 'strip', 'null', 'empty'],
  keywords: ['json', 'clean', 'strip', 'remove null', 'remove empty', 'falsy', 'prune', 'compact'],
  icon: 'Eraser',
  relatedTools: [],
};

export default meta;
