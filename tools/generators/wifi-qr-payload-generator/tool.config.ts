import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-wifi-qr-payload-generator-v1',
  name: 'WiFi QR Payload String Builder',
  slug: 'wifi-qr-payload-generator',
  description:
    'Build the WIFI: payload string for WiFi QR codes from SSID, password, encryption, and hidden flag.',
  category: 'generators',
  tags: ['wifi', 'qr', 'payload', 'network', 'ssid'],
  keywords: [
    'wifi qr',
    'WIFI:T:',
    'network qr code',
    'wifi password qr',
    'ssid payload',
    'wpa wep nopass',
    'join network qr',
  ],
  icon: 'Wifi',
  relatedTools: [],
};

export default meta;
