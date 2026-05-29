import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-jsonc-to-json-v1',
  name: 'JSONC / JSON5 to JSON',
  slug: 'jsonc-to-json',
  description: 'Strip comments and trailing commas from JSONC or JSON5 to produce strict, valid JSON.',
  category: 'data',
  tags: ['jsonc', 'json5', 'json'],
  keywords: ['jsonc', 'json5', 'comments', 'strip', 'convert'],
  icon: 'FileJson',
  relatedTools: [],
};

export default meta;
