import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-random-coordinates-generator-v1',
  name: 'Random Coordinates Generator',
  slug: 'random-coordinates-generator',
  description:
    'Generate random latitude/longitude points, optionally constrained to a bounding box.',
  category: 'generators',
  tags: ['geo', 'coordinates', 'latitude', 'longitude', 'random', 'map'],
  keywords: [
    'lat lng',
    'latlong',
    'geojson',
    'bounding box',
    'gps points',
    'random location',
    'geographic',
  ],
  icon: 'MapPin',
  relatedTools: [],
};

export default meta;
