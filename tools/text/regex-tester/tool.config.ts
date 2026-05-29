import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-regex-tester-v1',
  name: 'Regex Tester',
  slug: 'regex-tester',
  description: 'Test JavaScript regular expressions live with match highlighting and groups.',
  category: 'text',
  tags: ['regex', 'regexp', 'test', 'match', 'pattern'],
  keywords: ['regex tester', 'regular expression', 'pattern', 'match', 'capture groups'],
  icon: 'Regex',
  relatedTools: ['find-replace', 'sort-lines', 'word-count'],
};

export default meta;
