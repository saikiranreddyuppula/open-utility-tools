import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-gradient-generator-v1',
  name: 'CSS Gradient Generator',
  slug: 'gradient-generator',
  description: 'Build linear, radial and conic CSS gradients with a live preview.',
  category: 'color',
  tags: ['gradient', 'css', 'linear', 'radial', 'conic'],
  keywords: ['gradient', 'css gradient', 'linear gradient', 'radial', 'conic', 'background'],
  icon: 'Blend',
  relatedTools: ['color-converter', 'contrast-checker', 'color-picker'],
};

export default meta;
