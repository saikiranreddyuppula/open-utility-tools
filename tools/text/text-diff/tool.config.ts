import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-diff-v1',
  name: 'Text Diff',
  slug: 'text-diff',
  description: 'Compare two texts line-by-line and highlight additions and removals.',
  category: 'text',
  tags: ['diff', 'compare', 'changes', 'lcs'],
  keywords: ['diff', 'compare text', 'changes', 'difference', 'merge'],
  icon: 'Diff',
  relatedTools: ['json-diff', 'sort-lines', 'word-count'],
};

export default meta;
