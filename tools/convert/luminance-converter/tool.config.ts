import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-luminance-converter-v1',
  name: 'Luminance Converter',
  slug: 'luminance-converter',
  description: 'Convert luminance between candela/m2 (nit), foot-lambert, and stilb.',
  category: 'convert',
  tags: ['luminance', 'brightness', 'units', 'display', 'converter'],
  keywords: ['nit', 'candela', 'cd/m2', 'foot-lambert', 'stilb', 'apostilb', 'lambert', 'screen'],
  icon: 'Sun',
  relatedTools: [],
};

export default meta;
