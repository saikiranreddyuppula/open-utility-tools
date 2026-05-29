import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'math-unit-converter-v1',
  name: 'Unit Converter',
  slug: 'unit-converter',
  description: 'Convert length, mass, temperature, area, volume, speed and data sizes.',
  category: 'math',
  tags: ['units', 'convert', 'length', 'mass', 'temperature', 'data'],
  keywords: ['unit converter', 'length', 'weight', 'temperature', 'celsius fahrenheit', 'data size', 'metric imperial'],
  icon: 'Ruler',
  relatedTools: ['percentage-calculator', 'number-base-converter', 'data-size'],
};

export default meta;
