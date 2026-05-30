import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-vcard-qr-payload-generator-v1',
  name: 'MeCard / vCard QR Payload Builder',
  slug: 'vcard-qr-payload-generator',
  description: 'Build compact MECARD: and vCard contact payload strings sized for embedding in QR codes.',
  category: 'generators',
  tags: ['mecard', 'vcard', 'qr', 'contact', 'payload'],
  keywords: ['mecard', 'qr contact', 'vcard qr', 'contact qr code', 'qr payload', 'scannable contact'],
  icon: 'QrCode',
  relatedTools: [],
};

export default meta;
