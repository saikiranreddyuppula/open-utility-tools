import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-radiation-dose-converter-v1',
  name: 'Radiation Dose Converter',
  slug: 'radiation-dose-converter',
  description: 'Convert radiation dose between sieverts, rems, grays, and rads.',
  category: 'convert',
  tags: ['radiation', 'dose', 'units', 'physics', 'converter'],
  keywords: ['sievert', 'sv', 'rem', 'gray', 'gy', 'rad', 'absorbed', 'equivalent', 'dosimetry'],
  icon: 'Radar',
  relatedTools: [],
};

export default meta;
