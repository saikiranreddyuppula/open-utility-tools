import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-magnet-uri-builder-v1',
  name: 'Magnet & Data URI Builder',
  slug: 'magnet-uri-builder',
  description: 'Assemble magnet: links from an info hash and metadata fields offline.',
  category: 'generators',
  tags: ['magnet', 'uri', 'torrent', 'infohash', 'builder'],
  keywords: ['magnet link', 'magnet uri', 'btih', 'info hash', 'tracker', 'torrent', 'xt urn'],
  icon: 'Magnet',
  relatedTools: [],
};

export default meta;
