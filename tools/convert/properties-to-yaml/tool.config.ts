import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-properties-to-yaml-v1',
  name: 'Java Properties to YAML',
  slug: 'properties-to-yaml',
  description: 'Convert a Java .properties file into nested YAML by expanding dotted keys into a tree.',
  category: 'convert',
  tags: ['properties', 'yaml', 'java', 'spring', 'convert', 'config'],
  keywords: [
    'properties to yaml',
    'java properties',
    'spring config',
    'application.properties',
    'application.yml',
    'dotted keys',
  ],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
