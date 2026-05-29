import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-repair-v1',
  name: 'JSON Repair',
  slug: 'json-repair',
  description:
    'Fix broken JSON with single quotes, trailing commas, unquoted keys, and comments, then output valid JSON.',
  category: 'data',
  tags: ['json', 'repair', 'fix'],
  keywords: ['json', 'repair', 'fix', 'trailing comma', 'json5'],
  icon: 'Wrench',
  relatedTools: [],
};

export default meta;
