import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-flatten-v1',
  name: 'JSON Flatten / Unflatten',
  slug: 'json-flatten',
  description:
    'Flatten nested JSON into dot-notation keys or rebuild nested objects from flattened keys.',
  category: 'data',
  tags: ['json', 'flatten', 'unflatten'],
  keywords: ['json', 'flatten', 'unflatten', 'nested', 'dot notation'],
  icon: 'AlignJustify',
  relatedTools: [],
};

export default meta;
