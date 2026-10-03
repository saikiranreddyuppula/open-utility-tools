import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-regex-explainer-v1',
  name: 'Regex Explainer',
  slug: 'regex-explainer',
  description:
    'Break a JavaScript regular expression down into a plain-English explanation tree with colour-coded highlighting, capture groups, backtracking warnings and a live tester.',
  category: 'web',
  tags: ['regex', 'regexp', 'explain', 'debug', 'javascript', 'lint'],
  keywords: [
    'regular expression',
    'explain regex',
    'regex parser',
    'regex visualizer',
    'regex breakdown',
    'capture groups',
    'lookbehind',
    'named groups',
    'catastrophic backtracking',
    'redos',
    'unicode property escapes',
    'regex tester',
    'v flag',
  ],
  icon: 'Regex',
  relatedTools: ['regex-tester', 'web-regex-cheatsheet', 'web-regex-pattern-library', 'web-regex-escape'],
};

export default meta;
