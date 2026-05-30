import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-color-distance-deltae-v1',
  name: 'Color Difference (Delta-E)',
  slug: 'color-distance-deltae',
  description: 'Measure how different two colors are using CIE76, CIE94, and CIEDE2000.',
  category: 'color',
  tags: ['delta-e', 'color difference', 'cielab', 'ciede2000', 'distance'],
  keywords: ['deltae', 'de76', 'de94', 'de2000', 'lab', 'perceptual difference', 'color distance'],
  icon: 'Diff',
  relatedTools: [],
};

export default meta;
