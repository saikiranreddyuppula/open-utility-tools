import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-rgb-to-cmyk-converter-v1',
  name: 'RGB to CMYK Converter',
  slug: 'rgb-to-cmyk-converter',
  description: 'Convert sRGB to naive print CMYK percentages and back.',
  category: 'color',
  tags: ['color', 'rgb', 'cmyk', 'print', 'converter'],
  keywords: ['rgb to cmyk', 'cmyk to rgb', 'print color', 'cyan magenta yellow key', 'process color'],
  icon: 'Printer',
  relatedTools: [],
};

export default meta;
