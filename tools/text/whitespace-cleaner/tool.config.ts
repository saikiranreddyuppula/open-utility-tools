import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-whitespace-cleaner-v1',
  name: 'Whitespace Cleaner',
  slug: 'whitespace-cleaner',
  description: 'Trim lines, collapse spaces, strip blank lines, and normalize whitespace.',
  category: 'text',
  tags: ['whitespace', 'trim', 'clean', 'spaces', 'tabs'],
  keywords: ['whitespace', 'trim', 'collapse spaces', 'remove blank lines', 'clean text'],
  icon: 'Eraser',
  relatedTools: ['remove-duplicates', 'sort-lines', 'word-count'],
};

export default meta;
