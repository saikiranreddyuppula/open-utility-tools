import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-convert-color-list-to-tailwind-config-v1',
  name: 'Color List to Tailwind Config',
  slug: 'convert-color-list-to-tailwind-config',
  description:
    'Turns a list of name=hex color pairs into a Tailwind theme.extend.colors config object.',
  category: 'convert',
  tags: ['tailwind', 'color', 'config', 'theme', 'css'],
  keywords: ['tailwind', 'colors', 'theme.extend', 'palette', 'hex', 'config', 'design tokens'],
  icon: 'Palette',
  relatedTools: [],
};

export default meta;
