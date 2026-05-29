import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-number-lines-v1',
  name: 'Number Each Line',
  slug: 'number-lines',
  description:
    'Generate a sequence and prefix lines with auto-incrementing numbers using a start value, step, and zero-padding.',
  category: 'text',
  tags: ['text', 'lines', 'numbering'],
  keywords: ['line numbers', 'numbering', 'sequence', 'enumerate', 'increment'],
  icon: 'ListOrdered',
  relatedTools: [],
};

export default meta;
