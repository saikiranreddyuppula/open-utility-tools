import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-json-to-yaml-v1',
  name: 'JSON to YAML',
  slug: 'json-to-yaml',
  description: 'Convert JSON into readable YAML.',
  category: 'convert',
  tags: ['json', 'yaml', 'convert', 'config'],
  keywords: ['json to yaml', 'yaml', 'convert', 'config'],
  icon: 'ArrowLeftRight',
  relatedTools: ['yaml-to-json', 'json-formatter', 'json-to-csv'],
};

export default meta;
