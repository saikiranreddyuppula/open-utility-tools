import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-svg-pattern-v1',
  name: 'SVG Pattern Generator',
  slug: 'generate-svg-pattern',
  description:
    'Generate tileable SVG background patterns (dots, grid, stripes, checkerboard) with adjustable colors, size, and spacing, output as ready-to-use SVG markup.',
  category: 'generators',
  tags: ['svg', 'pattern', 'generator'],
  keywords: ['svg', 'pattern', 'background', 'tile', 'css', 'design'],
  icon: 'Grid3x3',
  relatedTools: [],
};

export default meta;
