import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-yaml-to-json-v1',
  name: 'YAML to JSON',
  slug: 'yaml-to-json',
  description: 'Convert common YAML configuration into JSON.',
  category: 'convert',
  tags: ['yaml', 'json', 'convert', 'config'],
  keywords: ['yaml to json', 'parse yaml', 'convert', 'config'],
  icon: 'ArrowLeftRight',
  relatedTools: ['json-to-yaml', 'json-formatter', 'csv-to-json'],
};

export default meta;
