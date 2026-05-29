import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-data-uri-decoder-v1',
  name: 'Data URI to Text',
  slug: 'web-data-uri-decoder',
  description:
    'Decode a data: URI back into its underlying text, revealing the MIME type, encoding, and the original content from base64 or percent-encoding.',
  category: 'web',
  tags: ['data-uri', 'decode', 'base64'],
  keywords: ['data-uri', 'decode', 'base64', 'mime', 'inline', 'uri'],
  icon: 'FileOutput',
  relatedTools: [],
};

export default meta;
