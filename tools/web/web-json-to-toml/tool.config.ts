import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-json-to-toml-v1',
  name: 'JSON to TOML',
  slug: 'web-json-to-toml',
  description:
    'Convert JSON configuration into TOML format and back, handling tables, arrays of tables, nested keys, strings, and numeric/boolean scalars.',
  category: 'web',
  tags: ['json', 'toml', 'convert'],
  keywords: ['json', 'toml', 'config', 'convert', 'cargo', 'settings'],
  icon: 'ArrowLeftRight',
  relatedTools: [],
};

export default meta;
