import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-hsl-to-hex-v1',
  name: 'HSL to HEX Converter',
  slug: 'hsl-to-hex',
  description:
    'Convert HSL color values to HEX and RGB, accepting standard hsl() notation and outputting clean web-ready codes.',
  category: 'color',
  tags: ['hsl', 'hex', 'rgb', 'color'],
  keywords: ['hsl', 'hex', 'rgb', 'convert', 'color'],
  icon: 'ArrowDownUp',
  relatedTools: [],
};

export default meta;
