import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-nearest-pantone-name-v1',
  name: 'Nearest Pantone-Style Name (Approx)',
  slug: 'nearest-pantone-name',
  description: 'Approximate the closest named swatch from an offline curated color-name dictionary.',
  category: 'color',
  tags: ['color-name', 'swatch', 'delta-e', 'approximate', 'palette'],
  keywords: ['pantone', 'color name', 'nearest swatch', 'lab', 'cie76', 'unofficial', 'dictionary'],
  icon: 'Stamp',
  relatedTools: [],
};

export default meta;
