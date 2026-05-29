import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-unicode-inspector-v1',
  name: 'Unicode Inspector',
  slug: 'unicode-inspector',
  description: 'Break text into code points with hex, decimal, UTF-8 bytes and names.',
  category: 'text',
  tags: ['unicode', 'code point', 'utf-8', 'inspect', 'character'],
  keywords: ['unicode inspector', 'code points', 'utf-8 bytes', 'character codes', 'escape unicode'],
  icon: 'Languages',
  relatedTools: ['ascii-table', 'binary-text', 'hex-text'],
};

export default meta;
