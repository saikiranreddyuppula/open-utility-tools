import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-rgb-to-lch-converter-v1',
  name: 'RGB to LCH Converter',
  slug: 'rgb-to-lch-converter',
  description: 'Convert sRGB to CIELCH (lightness, chroma, hue) and back.',
  category: 'color',
  tags: ['color', 'rgb', 'lch', 'cielch', 'converter'],
  keywords: ['rgb to lch', 'lch to rgb', 'cielch', 'lightness chroma hue', 'lab polar', 'lch()'],
  icon: 'Orbit',
  relatedTools: [],
};

export default meta;
