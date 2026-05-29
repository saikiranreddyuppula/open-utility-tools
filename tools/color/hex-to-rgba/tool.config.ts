import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-hex-to-rgba-v1',
  name: 'HEX to RGBA Converter',
  slug: 'hex-to-rgba',
  description:
    'Convert HEX color codes (including 8-digit HEX with alpha) to rgba() and back, controlling opacity with a percentage value.',
  category: 'color',
  tags: ['hex', 'rgba', 'alpha'],
  keywords: ['hex', 'rgba', 'alpha', 'opacity', 'convert'],
  icon: 'Droplet',
  relatedTools: [],
};

export default meta;
