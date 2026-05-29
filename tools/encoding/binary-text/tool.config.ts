import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-binary-text-v1',
  name: 'Text to Binary',
  slug: 'binary-text',
  description: 'Convert text to its binary (and back), with a configurable separator.',
  category: 'encoding',
  tags: ['binary', 'text', 'bits', 'convert', 'encode'],
  keywords: ['text to binary', 'binary to text', 'bits', 'ascii binary', 'utf-8 binary'],
  icon: 'Binary',
  relatedTools: ['hex-text', 'base64-text', 'number-base-converter'],
};

export default meta;
