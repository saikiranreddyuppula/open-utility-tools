import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-toml-to-yaml-v1',
  name: 'TOML to YAML',
  slug: 'toml-to-yaml',
  description: 'Convert TOML configuration into equivalent YAML.',
  category: 'convert',
  tags: ['toml', 'yaml', 'config', 'convert', 'serialize'],
  keywords: ['toml to yaml', 'configuration', 'tables', 'inline table', 'array of tables'],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
