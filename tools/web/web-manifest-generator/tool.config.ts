import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-manifest-generator-v1',
  name: 'Web App Manifest Generator',
  slug: 'web-manifest-generator',
  description:
    'Build a valid manifest.json (PWA) from name, colors, display and icons.',
  category: 'web',
  tags: ['pwa', 'manifest', 'web-app', 'json', 'icons'],
  keywords: [
    'web app manifest',
    'manifest.json',
    'pwa',
    'progressive web app',
    'icons',
    'theme color',
    'standalone',
    'maskable',
  ],
  icon: 'Smartphone',
  relatedTools: [],
};

export default meta;
