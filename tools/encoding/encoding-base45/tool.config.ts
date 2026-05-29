import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base45-v1',
  name: 'Base45 Encode / Decode',
  slug: 'encoding-base45',
  description:
    'Encode text to RFC 9285 Base45 or decode Base45 back to text, as used in QR-code data payloads.',
  category: 'encoding',
  tags: ['base45', 'rfc 9285', 'qr code', 'encode', 'decode'],
  keywords: ['base45', 'rfc 9285', 'qr code', 'encode', 'decode'],
  icon: 'QrCode',
  relatedTools: [],
};

export default meta;
