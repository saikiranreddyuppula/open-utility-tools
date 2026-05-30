import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-join-lines-v1',
  name: 'Join Lines',
  slug: 'join-lines',
  description: 'Concatenate multiple lines into one (or grouped) line using a chosen separator, with optional quoting.',
  category: 'text',
  tags: ['join', 'lines', 'concatenate', 'separator', 'csv'],
  keywords: ['join lines', 'merge lines', 'one line', 'comma separate', 'sql in list', 'array literal', 'concatenate lines'],
  icon: 'Link2',
  relatedTools: [],
};

export default meta;
