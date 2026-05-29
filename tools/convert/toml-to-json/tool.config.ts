import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-toml-to-json-v1',
  name: 'TOML to JSON',
  slug: 'toml-to-json',
  description: 'Turn TOML config files into JSON. Supports tables, arrays of tables, inline tables, datetimes, and typed values, parsed locally without uploads.',
  category: 'convert',
  tags: ['toml', 'json', 'convert'],
  keywords: ['toml', 'json', 'convert', 'config', 'cargo', 'pyproject'],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
