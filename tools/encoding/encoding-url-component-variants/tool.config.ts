import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-url-component-variants-v1',
  name: 'URL Encode Variants (encodeURI vs encodeURIComponent)',
  slug: 'encoding-url-component-variants',
  description:
    'Compare and apply the three JavaScript URL-encoding functions side by side on the same input.',
  category: 'encoding',
  tags: ['url', 'encode', 'percent', 'escape', 'compare'],
  keywords: [
    'encodeuri',
    'encodeuricomponent',
    'escape',
    'unescape',
    'percent encoding',
    'url encode',
    'decodeuri',
  ],
  icon: 'Link2',
  relatedTools: [],
};

export default meta;
