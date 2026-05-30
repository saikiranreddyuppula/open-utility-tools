import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-accessible-text-color-v1',
  name: 'Accessible Text Color Picker',
  slug: 'accessible-text-color',
  description:
    'Decide whether black or white text is more readable on any background color.',
  category: 'color',
  tags: ['accessibility', 'contrast', 'wcag', 'color', 'text'],
  keywords: [
    'accessible text',
    'black or white text',
    'wcag contrast',
    'readable',
    'foreground color',
    'a11y',
    'luminance',
  ],
  icon: 'Eye',
  relatedTools: [],
};

export default meta;
