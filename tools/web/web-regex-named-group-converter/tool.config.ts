import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-regex-named-group-converter-v1',
  name: 'Regex Named Group Reference Converter',
  slug: 'web-regex-named-group-converter',
  description:
    'Convert between numbered capture groups and named capture groups in regex patterns and their backreferences/replacements.',
  category: 'web',
  tags: ['regex', 'capture groups', 'named groups', 'convert', 'backreference'],
  keywords: ['regular expression', 'numbered groups', 'k<name>', 'replacement', '$1', 'rewrite'],
  icon: 'Parentheses',
  relatedTools: [],
};

export default meta;
