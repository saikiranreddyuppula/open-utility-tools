import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-kelvin-to-rgb-v1',
  name: 'Color Temperature (Kelvin) Converter',
  slug: 'kelvin-to-rgb',
  description:
    'Convert a color temperature in Kelvin to its approximate RGB/HEX color, useful for lighting, white balance, and warm/cool tone work.',
  category: 'color',
  tags: ['kelvin', 'temperature', 'rgb', 'white balance'],
  keywords: ['kelvin', 'temperature', 'white balance', 'rgb', 'warm'],
  icon: 'Thermometer',
  relatedTools: [],
};

export default meta;
