import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-qr-code-generator-v1',
  name: 'QR Code Generator',
  slug: 'qr-code-generator',
  description:
    'Create QR codes for URLs, text, Wi-Fi, email, phone, SMS, contacts and locations with styling, a centre logo, and PNG or SVG download.',
  category: 'generators',
  tags: ['qr', 'qr code', 'wifi', 'vcard', 'svg', 'png'],
  keywords: [
    'qr code maker',
    'qr generator',
    'create qr code',
    'wifi qr code',
    'vcard qr',
    'qr code with logo',
    'qr code svg',
    'qr code png',
    'url to qr',
    'error correction level',
    'reed solomon',
    'mailto qr',
    'sms qr',
    'geo qr',
  ],
  icon: 'QrCode',
  relatedTools: ['wifi-qr-payload-generator', 'vcard-qr-payload-generator', 'generate-barcode'],
};

export default meta;
