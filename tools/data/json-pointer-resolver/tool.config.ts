import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-pointer-resolver-v1',
  name: 'JSON Pointer Resolver',
  slug: 'json-pointer-resolver',
  description: 'Resolve an RFC 6901 JSON Pointer against a JSON document.',
  category: 'data',
  tags: ['json', 'json-pointer', 'rfc6901', 'resolve', 'lookup'],
  keywords: ['json pointer', 'rfc 6901', 'resolve pointer', 'json path token', 'lookup value'],
  icon: 'Crosshair',
  relatedTools: [],
};

export default meta;
