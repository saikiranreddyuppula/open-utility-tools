import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-interleave-lines-v1',
  name: 'Interleave / Zip Lines',
  slug: 'interleave-lines',
  description: 'Merge two or more line-lists by alternating their lines, like a zipper, with a configurable separator.',
  category: 'text',
  tags: ['interleave', 'zip', 'merge', 'lines', 'combine'],
  keywords: ['interleave lines', 'zip lists', 'merge lines', 'alternate lines', 'round robin', 'side by side'],
  icon: 'Combine',
  relatedTools: [],
};

export default meta;
