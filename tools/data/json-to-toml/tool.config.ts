import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-toml-v1',
  name: 'JSON to TOML',
  slug: 'json-to-toml',
  description: 'Convert JSON into TOML config format with tables, arrays, and typed scalars.',
  category: 'data',
  tags: ['json', 'toml'],
  keywords: ['json', 'toml', 'convert', 'config', 'serialize'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
