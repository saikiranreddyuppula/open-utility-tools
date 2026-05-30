import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-curl-to-httpie-v1',
  name: 'cURL to HTTPie',
  slug: 'curl-to-httpie',
  description: 'Convert a curl command into an equivalent HTTPie command.',
  category: 'convert',
  tags: ['curl', 'httpie', 'http', 'convert', 'api'],
  keywords: ['curl2httpie', 'request', 'rest', 'command', 'cli'],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
