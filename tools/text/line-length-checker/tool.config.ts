import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-line-length-checker-v1',
  name: 'Line Length Checker',
  slug: 'line-length-checker',
  description: 'Flag lines that exceed a maximum character width for code or prose style guides.',
  category: 'text',
  tags: ['line length', 'width', 'lint', 'columns', 'style'],
  keywords: ['line length checker', 'max width', '80 columns', 'line too long', 'column limit', 'wrap check'],
  icon: 'Ruler',
  relatedTools: [],
};

export default meta;
