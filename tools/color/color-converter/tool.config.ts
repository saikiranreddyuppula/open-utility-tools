import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-converter-v1',
  name: 'Color Converter',
  slug: 'color-converter',
  description: 'Convert colors between HEX, RGB, HSL, HSV, CMYK and OKLCH, with a live preview.',
  category: 'color',
  tags: ['color', 'hex', 'rgb', 'hsl', 'oklch', 'cmyk', 'convert'],
  keywords: ['color converter', 'hex to rgb', 'hsl', 'oklch', 'cmyk', 'hsv', 'picker'],
  icon: 'Palette',
  relatedTools: ['contrast-checker', 'color-picker', 'gradient-generator'],
};

export default meta;
