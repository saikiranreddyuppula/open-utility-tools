import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-dpi-ppi-size-converter-v1',
  name: 'DPI / PPI Pixel-Size Converter',
  slug: 'dpi-ppi-size-converter',
  description:
    'Convert between physical print size, pixel dimensions, and DPI — or compute a screen’s PPI from its resolution and diagonal.',
  category: 'convert',
  tags: ['dpi', 'ppi', 'print', 'pixels', 'resolution'],
  keywords: ['dots per inch', 'pixels per inch', 'print size', 'screen density', 'dot pitch'],
  icon: 'Scan',
  relatedTools: [],
};

export default meta;
