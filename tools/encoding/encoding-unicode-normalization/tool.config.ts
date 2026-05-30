import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-unicode-normalization-v1',
  name: 'Unicode Normalization (NFC/NFD/NFKC/NFKD)',
  slug: 'encoding-unicode-normalization',
  description: 'Apply and compare the four Unicode normalization forms to text.',
  category: 'encoding',
  tags: ['unicode', 'normalization', 'nfc', 'nfd', 'text'],
  keywords: [
    'normalize',
    'nfc',
    'nfd',
    'nfkc',
    'nfkd',
    'composition',
    'decomposition',
    'diacritics',
    'ligature',
  ],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
