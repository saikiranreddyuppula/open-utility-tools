import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-rgb-to-hex-v1',
  name: 'RGB to HEX Converter',
  slug: 'rgb-to-hex',
  description:
    'Convert rgb()/rgba() color values to HEX (and 8-digit HEX when alpha is present), accepting comma or space separated channels.',
  category: 'color',
  tags: ['rgb', 'hex', 'rgba', 'color'],
  keywords: ['rgb', 'hex', 'rgba', 'convert', 'color'],
  icon: 'ArrowLeftRight',
  relatedTools: [],
};

export default meta;
