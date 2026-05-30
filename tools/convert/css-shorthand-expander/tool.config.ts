import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-css-shorthand-expander-v1',
  name: 'CSS Shorthand Expander',
  slug: 'css-shorthand-expander',
  description:
    'Expand CSS shorthand properties (margin, padding, border, font, background, etc.) into their longhand declarations, or collapse longhands back.',
  category: 'convert',
  tags: ['css', 'shorthand', 'longhand', 'stylesheet', 'expand'],
  keywords: ['css shorthand', 'expand margin', 'longhand', 'border shorthand', 'font shorthand', 'collapse'],
  icon: 'Code2',
  relatedTools: [],
};

export default meta;
