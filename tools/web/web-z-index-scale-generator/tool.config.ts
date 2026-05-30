import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-z-index-scale-generator-v1',
  name: 'Z-Index Scale Generator',
  slug: 'web-z-index-scale-generator',
  description:
    'Generate a documented z-index scale with named layers as CSS variables or a Sass/JS map to avoid stacking chaos.',
  category: 'web',
  tags: ['css', 'z-index', 'design-system', 'tokens', 'layering'],
  keywords: [
    'stacking context',
    'z-index map',
    'css custom properties',
    'sass map',
    'design tokens',
    'layers',
    'modal tooltip',
  ],
  icon: 'Layers',
  relatedTools: [],
};

export default meta;
