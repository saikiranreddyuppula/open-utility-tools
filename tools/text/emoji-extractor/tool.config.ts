import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-emoji-extractor-v1',
  name: 'Emoji Extractor',
  slug: 'emoji-extractor',
  description: 'Extract every emoji from text and list them with counts and code points.',
  category: 'text',
  tags: ['emoji', 'extract', 'count', 'unicode', 'codepoints'],
  keywords: [
    'extract emoji',
    'find emoji',
    'emoji list',
    'emoji frequency',
    'code points',
    'zwj sequence',
  ],
  icon: 'Sparkles',
  relatedTools: [],
};

export default meta;
