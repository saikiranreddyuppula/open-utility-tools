import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-remove-line-breaks-v1',
  name: 'Remove Line Breaks',
  slug: 'remove-line-breaks',
  description:
    'Strip or normalize line breaks, joining wrapped lines into one with spaces, collapsing multiple blank lines, or converting paragraphs to single lines.',
  category: 'text',
  tags: ['line breaks', 'newlines', 'join'],
  keywords: ['line breaks', 'newlines', 'join lines', 'strip', 'paragraph'],
  icon: 'Pilcrow',
  relatedTools: [],
};

export default meta;
