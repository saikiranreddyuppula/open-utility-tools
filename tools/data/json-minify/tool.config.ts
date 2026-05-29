import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-minify-v1',
  name: 'JSON Minify',
  slug: 'json-minify',
  description: 'Strip whitespace from JSON to produce the smallest valid output.',
  category: 'data',
  tags: ['json', 'minify', 'compress', 'compact'],
  keywords: ['json minify', 'compact json', 'compress json', 'strip whitespace'],
  icon: 'Minimize2',
  relatedTools: ['json-formatter', 'json-to-csv', 'json-diff'],
};

export default meta;
