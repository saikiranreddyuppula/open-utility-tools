import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-punycode-v1',
  name: 'Punycode Encode / Decode',
  slug: 'encoding-punycode',
  description:
    'Convert internationalized domain names to ASCII Punycode (xn--) and back to their Unicode form.',
  category: 'encoding',
  tags: ['punycode', 'idn', 'domain'],
  keywords: ['punycode', 'idn', 'domain', 'xn--', 'unicode', 'encode'],
  icon: 'Globe',
  relatedTools: [],
};

export default meta;
