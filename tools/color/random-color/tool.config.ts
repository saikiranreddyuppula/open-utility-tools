import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-random-color-v1',
  name: 'Random Color Generator',
  slug: 'random-color',
  description: 'Generate random colors with copyable HEX/RGB/HSL values.',
  category: 'color',
  tags: ['random', 'color', 'generator', 'swatch'],
  keywords: ['random color', 'color generator', 'random hex', 'swatch'],
  icon: 'Shuffle',
  relatedTools: ['color-harmony', 'color-converter', 'color-shades'],
};

export default meta;
