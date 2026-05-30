import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-color-temperature-shift-v1',
  name: 'Color Temperature Shift',
  slug: 'color-temperature-shift',
  description: 'Warm or cool a color by shifting it toward a target white point.',
  category: 'color',
  tags: ['color', 'temperature', 'warm', 'cool', 'kelvin'],
  keywords: ['white balance', 'warm color', 'cool color', 'color temperature', 'tint color'],
  icon: 'Thermometer',
  relatedTools: [],
};

export default meta;
