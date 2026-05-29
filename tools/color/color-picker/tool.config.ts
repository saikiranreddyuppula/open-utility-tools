import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-picker-v1',
  name: 'Color Picker',
  slug: 'color-picker',
  description: 'Pick a color visually and read its HEX, RGB, HSL and OKLCH values.',
  category: 'color',
  tags: ['color', 'picker', 'eyedropper', 'hex', 'swatch'],
  keywords: ['color picker', 'eyedropper', 'hex picker', 'swatch', 'pick color'],
  icon: 'Pipette',
  relatedTools: ['color-converter', 'color-shades', 'gradient-generator'],
};

export default meta;
