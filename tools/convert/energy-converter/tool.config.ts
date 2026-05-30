import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-energy-converter-v1',
  name: 'Energy Converter',
  slug: 'energy-converter',
  description: 'Convert energy between joules, calories, kWh, BTU, and electronvolts.',
  category: 'convert',
  tags: ['energy', 'joule', 'calorie', 'kwh', 'btu', 'physics'],
  keywords: [
    'energy',
    'joule',
    'kilojoule',
    'calorie',
    'kilocalorie',
    'watt hour',
    'kilowatt hour',
    'kwh',
    'btu',
    'electronvolt',
    'ev',
    'erg',
    'foot pound',
  ],
  icon: 'Zap',
  relatedTools: [],
};

export default meta;
