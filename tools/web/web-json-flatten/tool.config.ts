import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-json-flatten-v1',
  name: 'JSON Flatten / Unflatten',
  slug: 'web-json-flatten',
  description:
    'Flatten a deeply nested JSON object into single-level dot-notation keys, or rebuild nested structure from flattened keys.',
  category: 'web',
  tags: ['json', 'flatten', 'transform'],
  keywords: ['json', 'flatten', 'nested', 'unflatten', 'dot-notation', 'transform'],
  icon: 'AlignJustify',
  relatedTools: [],
};

export default meta;
