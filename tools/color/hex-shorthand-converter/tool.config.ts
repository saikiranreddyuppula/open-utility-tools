import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-hex-shorthand-converter-v1',
  name: 'HEX Shorthand Expander',
  slug: 'hex-shorthand-converter',
  description:
    'Expand 3/4-digit shorthand HEX to 6/8-digit and minify back when possible.',
  category: 'color',
  tags: ['hex', 'color', 'shorthand', 'expand', 'minify'],
  keywords: [
    'hex shorthand',
    'expand hex',
    'minify hex',
    '3 digit hex',
    '8 digit hex',
    'hex alpha',
    'normalize',
  ],
  icon: 'Hash',
  relatedTools: [],
};

export default meta;
