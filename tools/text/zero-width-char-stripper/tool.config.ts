import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-zero-width-char-stripper-v1',
  name: 'Zero-Width & Invisible Character Stripper',
  slug: 'zero-width-char-stripper',
  description:
    'Detect and remove invisible zero-width and formatting characters from pasted text.',
  category: 'text',
  tags: ['zero-width', 'invisible', 'unicode', 'clean', 'sanitize'],
  keywords: [
    'zero width space',
    'invisible characters',
    'strip zwsp',
    'remove bom',
    'soft hyphen',
    'directional marks',
  ],
  icon: 'Ghost',
  relatedTools: [],
};

export default meta;
