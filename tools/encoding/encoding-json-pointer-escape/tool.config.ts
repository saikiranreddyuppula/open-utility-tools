import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-json-pointer-escape-v1',
  name: 'JSON Pointer Escaper (RFC 6901)',
  slug: 'encoding-json-pointer-escape',
  description:
    'Encode and decode JSON Pointer reference tokens with the ~0/~1 escape rules.',
  category: 'encoding',
  tags: ['json-pointer', 'rfc6901', 'escape', 'json', 'reference-token'],
  keywords: [
    'json pointer',
    'rfc 6901',
    'reference token',
    'tilde escape',
    'uri fragment',
    'json path',
    'encode',
    'decode',
  ],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
