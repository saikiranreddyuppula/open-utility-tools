import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-key-case-converter-v1',
  name: 'JSON Key Case Converter',
  slug: 'json-key-case-converter',
  description: 'Recursively convert all JSON object keys to a chosen case.',
  category: 'data',
  tags: ['json', 'keys', 'case', 'camelcase', 'snake_case'],
  keywords: ['json', 'keys', 'case', 'camelcase', 'snake_case', 'kebab-case', 'pascalcase', 'rename keys'],
  icon: 'CaseSensitive',
  relatedTools: [],
};

export default meta;
