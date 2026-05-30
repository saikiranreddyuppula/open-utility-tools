import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-nginx-location-snippet-v1',
  name: 'Nginx Config Snippet Generator',
  slug: 'web-nginx-location-snippet',
  description:
    'Generate common Nginx server/location blocks from form options (no server needed).',
  category: 'web',
  tags: ['nginx', 'config', 'devops', 'server', 'proxy'],
  keywords: [
    'nginx',
    'config',
    'reverse proxy',
    'try_files',
    'spa',
    'gzip',
    'https redirect',
    'rate limit',
    'cache headers',
  ],
  icon: 'ServerCog',
  relatedTools: [],
};

export default meta;
