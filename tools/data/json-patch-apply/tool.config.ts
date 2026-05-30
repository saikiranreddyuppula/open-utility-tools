import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-patch-apply-v1',
  name: 'JSON Patch Apply',
  slug: 'json-patch-apply',
  description: 'Apply an RFC 6902 JSON Patch to a JSON document.',
  category: 'data',
  tags: ['json', 'patch', 'rfc6902', 'json-pointer', 'apply'],
  keywords: ['json patch', 'rfc 6902', 'apply patch', 'json pointer', 'add remove replace move'],
  icon: 'FileCog',
  relatedTools: [],
};

export default meta;
