import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-query-params-diff-v1',
  name: 'URL Query Params Diff',
  slug: 'web-query-params-diff',
  description: 'Compare the query strings of two URLs and show which params were added, removed, changed, or unchanged.',
  category: 'web',
  tags: ['url', 'query', 'diff', 'compare', 'params'],
  keywords: ['query string diff', 'compare urls', 'url params', 'added removed changed', 'querystring', 'searchparams'],
  icon: 'Diff',
  relatedTools: [],
};

export default meta;
