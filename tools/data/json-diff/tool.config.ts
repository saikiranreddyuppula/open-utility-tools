import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-diff-v1',
  name: 'JSON Diff',
  slug: 'json-diff',
  description: 'Compare two JSON documents (normalized & sorted) and see the changes.',
  category: 'data',
  tags: ['json', 'diff', 'compare', 'changes'],
  keywords: ['json diff', 'compare json', 'changes', 'difference'],
  icon: 'GitCompare',
  relatedTools: ['text-diff', 'json-formatter', 'json-minify'],
};

export default meta;
