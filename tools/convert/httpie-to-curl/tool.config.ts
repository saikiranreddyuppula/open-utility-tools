import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-httpie-to-curl-v1',
  name: 'HTTPie to cURL',
  slug: 'httpie-to-curl',
  description: 'Convert an HTTPie command into an equivalent curl command.',
  category: 'convert',
  tags: ['httpie', 'curl', 'http', 'convert', 'api'],
  keywords: ['httpie2curl', 'request', 'rest', 'command', 'cli'],
  icon: 'Terminal',
  relatedTools: [],
};

export default meta;
