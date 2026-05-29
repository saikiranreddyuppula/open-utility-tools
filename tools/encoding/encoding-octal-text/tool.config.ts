import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-octal-text-v1',
  name: 'Octal Encode / Decode',
  slug: 'encoding-octal-text',
  description:
    'Encode UTF-8 text to space-separated octal byte values or decode octal numbers back into readable text.',
  category: 'encoding',
  tags: ['octal', 'base 8', 'bytes'],
  keywords: ['octal', 'base 8', 'encode', 'decode', 'bytes', 'text'],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
