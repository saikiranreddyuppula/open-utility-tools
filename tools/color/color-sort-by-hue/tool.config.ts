import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-color-sort-by-hue-v1',
  name: 'Color List Sorter',
  slug: 'color-sort-by-hue',
  description:
    'Sort a pasted list of colors by hue, lightness, saturation, or luminance.',
  category: 'color',
  tags: ['color', 'sort', 'hue', 'palette', 'luminance'],
  keywords: [
    'sort colors',
    'hue sort',
    'step sort',
    'palette order',
    'luminance',
    'saturation',
    'lightness',
  ],
  icon: 'SortAsc',
  relatedTools: [],
};

export default meta;
