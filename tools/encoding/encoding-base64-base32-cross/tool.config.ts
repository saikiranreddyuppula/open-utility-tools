import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base64-base32-cross-v1',
  name: 'Base64 ↔ Base32 Cross Converter',
  slug: 'encoding-base64-base32-cross',
  description:
    'Directly transcode between Base64 and Base32 representations of the same bytes without manual decode/encode.',
  category: 'encoding',
  tags: ['base64', 'base32', 'transcode', 'convert', 'rfc4648'],
  keywords: [
    'base64',
    'base32',
    'transcode',
    'cross convert',
    'url-safe',
    'base32hex',
    'rfc 4648',
  ],
  icon: 'ArrowLeftRight',
  relatedTools: [],
};

export default meta;
