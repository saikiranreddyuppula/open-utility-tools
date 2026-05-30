import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-license-key-generator-v1',
  name: 'License Key Generator',
  slug: 'license-key-generator',
  description: 'Generate grouped license/serial keys with a configurable checksum group.',
  category: 'generators',
  tags: ['license', 'serial', 'key', 'checksum', 'product-key'],
  keywords: [
    'license key',
    'serial number',
    'product key',
    'activation code',
    'crockford base32',
    'checksum',
    'crc32',
  ],
  icon: 'FileBadge',
  relatedTools: [],
};

export default meta;
