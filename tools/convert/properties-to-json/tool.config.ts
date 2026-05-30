import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-properties-to-json-v1',
  name: 'Java .properties to JSON',
  slug: 'properties-to-json',
  description: 'Convert Java/Spring .properties files into nested JSON.',
  category: 'convert',
  tags: ['properties', 'json', 'java', 'spring', 'convert', 'config'],
  keywords: [
    'properties to json',
    'java properties',
    'spring config',
    'application.properties',
    'dotted keys',
    'nested json',
  ],
  icon: 'FileText',
  relatedTools: [],
};

export default meta;
