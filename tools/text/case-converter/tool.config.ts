import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-case-converter-v1',
  name: 'Case Converter',
  slug: 'case-converter',
  description: 'Convert text between camelCase, snake_case, kebab-case, Title Case and more.',
  category: 'text',
  tags: ['case', 'camel', 'snake', 'kebab', 'title'],
  keywords: ['camelcase', 'snake_case', 'kebab', 'pascal', 'title case', 'uppercase', 'lowercase'],
  icon: 'CaseSensitive',
  relatedTools: ['slugify', 'json-formatter', 'hash-text'],
};

export default meta;
