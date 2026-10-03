import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-geo-data-converter-v1',
  name: 'GPX / KML / GeoJSON Converter',
  slug: 'geo-data-converter',
  description:
    'Convert GPS tracks and map data between GPX, KML/KMZ, GeoJSON, CSV, WKT and encoded polylines privately in your browser, with simplify, stats and a map preview.',
  category: 'convert',
  tags: ['gpx', 'kml', 'geojson', 'gps', 'map', 'convert'],
  keywords: [
    'gpx to kml',
    'kml to geojson',
    'geojson to gpx',
    'kmz converter',
    'gps track converter',
    'csv to gpx',
    'wkt to geojson',
    'polyline decoder',
    'topojson to geojson',
    'tcx to gpx',
    'simplify track',
    'elevation gain',
    'private gps converter',
  ],
  icon: 'Map',
  relatedTools: ['random-coordinates-generator', 'json-formatter', 'csv-to-json'],
};

export default meta;
