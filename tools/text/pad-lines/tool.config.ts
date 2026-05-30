import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-pad-lines-v1',
  name: 'Pad & Align Lines',
  slug: 'pad-lines',
  description:
    'Left/right/center-pad every line to a target width with a fill character, or zero-pad numbers.',
  category: 'text',
  tags: ['pad', 'align', 'width', 'fill', 'lines'],
  keywords: [
    'pad lines',
    'align text',
    'padstart',
    'padend',
    'zero pad',
    'fill character',
    'fixed width',
    'columns',
  ],
  icon: 'AlignJustify',
  relatedTools: [],
};

export default meta;
