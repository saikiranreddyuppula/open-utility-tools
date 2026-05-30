import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-filter-adjust-v1',
  name: 'Brightness / Contrast / Saturation Adjuster',
  slug: 'image-filter-adjust',
  description:
    'Tweak brightness, contrast, saturation, and hue of an image with live sliders.',
  category: 'image',
  tags: ['brightness', 'contrast', 'saturation', 'hue', 'filter'],
  keywords: [
    'brightness',
    'contrast',
    'saturation',
    'hue rotate',
    'image adjust',
    'photo filter',
    'color correction',
  ],
  icon: 'SlidersHorizontal',
  relatedTools: [],
};

export default meta;
