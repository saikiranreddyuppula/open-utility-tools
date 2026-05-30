import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-reverse-lines-v1',
  name: 'Reverse & Flip Lines',
  slug: 'reverse-lines',
  description:
    'Reverse the order of lines, reverse characters within each line, or rotate lines by an offset.',
  category: 'text',
  tags: ['reverse', 'flip', 'rotate', 'lines', 'order'],
  keywords: [
    'reverse lines',
    'flip text',
    'rotate lines',
    'reverse characters',
    'last first',
    'shift lines',
    'grapheme',
  ],
  icon: 'ArrowDownUp',
  relatedTools: [],
};

export default meta;
