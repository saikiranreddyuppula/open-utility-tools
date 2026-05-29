import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-unicode-escape-v1',
  name: 'Unicode Escape / Unescape',
  slug: 'encoding-unicode-escape',
  description: 'Convert characters to \\uXXXX escape sequences or unescape them back to readable Unicode text.',
  category: 'encoding',
  tags: ['unicode', 'escape', 'unescape'],
  keywords: ['unicode', 'escape', 'unescape', '\\u', 'code point', 'javascript'],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
