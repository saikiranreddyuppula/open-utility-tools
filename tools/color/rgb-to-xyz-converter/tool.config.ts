import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-rgb-to-xyz-converter-v1',
  name: 'RGB to CIE XYZ Converter',
  slug: 'rgb-to-xyz-converter',
  description: 'Convert sRGB to CIE 1931 XYZ tristimulus values (D65) and back.',
  category: 'color',
  tags: ['color', 'rgb', 'xyz', 'cie', 'converter'],
  keywords: ['rgb to xyz', 'xyz to rgb', 'cie 1931', 'tristimulus', 'd65', 'color space'],
  icon: 'Microscope',
  relatedTools: [],
};

export default meta;
