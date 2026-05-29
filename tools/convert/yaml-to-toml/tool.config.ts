import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-yaml-to-toml-v1',
  name: 'YAML to TOML',
  slug: 'yaml-to-toml',
  description: 'Convert YAML configuration directly into TOML, mapping nested maps and lists into tables and arrays of tables in one step.',
  category: 'convert',
  tags: ['yaml', 'toml', 'convert'],
  keywords: ['yaml', 'toml', 'convert', 'config', 'transform', 'yml'],
  icon: 'ArrowLeftRight',
  relatedTools: [],
};

export default meta;
