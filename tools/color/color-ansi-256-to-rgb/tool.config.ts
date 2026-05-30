import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'color-color-ansi-256-to-rgb-v1',
  name: 'ANSI 256-Color to RGB',
  slug: 'color-ansi-256-to-rgb',
  description:
    'Map xterm 256-color palette indices to RGB hex and back to the nearest index.',
  category: 'color',
  tags: ['ansi', 'xterm', 'terminal', 'color', 'rgb'],
  keywords: [
    'ansi 256',
    'xterm color',
    'terminal color',
    '256 color',
    'sgr escape',
    'color index',
    'nearest color',
  ],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
