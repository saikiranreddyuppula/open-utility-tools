import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-regex-match-lines-v1',
  name: 'Regex Match Against Lines',
  slug: 'web-regex-match-lines',
  description:
    'Run a regex against each line of pasted text and list which lines match, which do not, and the captured groups.',
  category: 'web',
  tags: ['regex', 'lines', 'filter', 'grep', 'match'],
  keywords: ['regular expression', 'grep', 'capture groups', 'test', 'pattern', 'per line'],
  icon: 'ListFilter',
  relatedTools: [],
};

export default meta;
