import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-find-replace-v1',
  name: 'Find & Replace',
  slug: 'find-replace',
  description: 'Find and replace text with plain or regular-expression matching.',
  category: 'text',
  tags: ['find', 'replace', 'regex', 'substitute'],
  keywords: ['find and replace', 'search replace', 'regex replace', 'substitute'],
  icon: 'Regex',
  relatedTools: ['regex-tester', 'sort-lines', 'whitespace-cleaner'],
};

export default meta;
