import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-palette-from-numbers-v1',
  name: 'Palette from Numbers',
  slug: 'palette-from-numbers',
  description: 'Turn any number, ID, or seed string into a deterministic reproducible color palette.',
  category: 'color',
  tags: ['color', 'palette', 'seed', 'deterministic', 'generator'],
  keywords: ['seed', 'hash', 'avatar colors', 'tag colors', 'golden angle', 'reproducible', 'fnv'],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
