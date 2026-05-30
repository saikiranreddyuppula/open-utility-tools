import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-rgb-to-lab-converter-v1',
  name: 'RGB to CIELAB Converter',
  slug: 'rgb-to-lab-converter',
  description: 'Convert sRGB to CIELAB (L*a*b*) under D65 and back.',
  category: 'color',
  tags: ['color', 'rgb', 'lab', 'cielab', 'converter'],
  keywords: ['rgb to lab', 'lab to rgb', 'cielab', 'l*a*b*', 'd65', 'perceptual color'],
  icon: 'FlaskConical',
  relatedTools: [],
};

export default meta;
