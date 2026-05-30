import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-word-ladder-diff-v1',
  name: 'Side-by-Side Word Diff',
  slug: 'text-word-ladder-diff',
  description: 'Compare two texts and highlight word-level insertions and deletions inline.',
  category: 'text',
  tags: ['diff', 'compare', 'words', 'lcs', 'changes'],
  keywords: ['word diff', 'text compare', 'inline diff', 'added removed', 'lcs diff'],
  icon: 'Diff',
  relatedTools: [],
};

export default meta;
