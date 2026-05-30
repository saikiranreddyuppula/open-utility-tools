import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-convert-har-to-curl-v1',
  name: 'HAR Entry to cURL',
  slug: 'convert-har-to-curl',
  description:
    'Extracts requests from a HAR file or single HAR entry and emits equivalent cURL commands.',
  category: 'convert',
  tags: ['har', 'curl', 'http', 'devtools', 'network'],
  keywords: ['har to curl', 'network log', 'request', 'replay', 'devtools export', 'fiddler'],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
