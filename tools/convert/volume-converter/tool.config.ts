import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-volume-converter-v1',
  name: 'Volume Converter',
  slug: 'volume-converter',
  description: 'Convert liquid and dry volumes between liters, gallons, cups, pints, and more.',
  category: 'convert',
  tags: ['volume', 'units', 'converter', 'cooking', 'measurement'],
  keywords: [
    'liter',
    'gallon',
    'cup',
    'pint',
    'quart',
    'fluid ounce',
    'milliliter',
    'imperial',
    'us customary',
  ],
  icon: 'FlaskConical',
  relatedTools: [],
};

export default meta;
