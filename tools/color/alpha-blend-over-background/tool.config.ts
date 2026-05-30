import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-alpha-blend-over-background-v1',
  name: 'Alpha Blend Over Background',
  slug: 'alpha-blend-over-background',
  description:
    'Compute the solid opaque color produced by a translucent color over a background.',
  category: 'color',
  tags: ['alpha', 'blend', 'compositing', 'color', 'opacity'],
  keywords: [
    'alpha blend',
    'source over',
    'flatten color',
    'rgba over background',
    'opacity',
    'compositing',
    'transparent',
  ],
  icon: 'Layers',
  relatedTools: [],
};

export default meta;
