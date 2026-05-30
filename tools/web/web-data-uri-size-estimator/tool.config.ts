import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-data-uri-size-estimator-v1',
  name: 'Data URI Size Estimator',
  slug: 'web-data-uri-size-estimator',
  description: 'Estimate the byte size and overhead of a Base64 data URI for a given raw file size before embedding it.',
  category: 'web',
  tags: ['data-uri', 'base64', 'size', 'overhead', 'estimate'],
  keywords: ['data url', 'inline image', 'embed', 'encoding overhead', 'base64 size', 'bytes', 'kb'],
  icon: 'Gauge',
  relatedTools: [],
};

export default meta;
