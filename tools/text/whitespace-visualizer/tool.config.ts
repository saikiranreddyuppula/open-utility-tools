import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-whitespace-visualizer-v1',
  name: 'Whitespace & Special Character Visualizer',
  slug: 'whitespace-visualizer',
  description:
    'Reveal hidden spaces, tabs, and line endings by replacing them with visible glyphs.',
  category: 'text',
  tags: ['whitespace', 'visualize', 'tabs', 'line-endings', 'debug'],
  keywords: [
    'show whitespace',
    'reveal spaces',
    'visualize tabs',
    'line endings',
    'crlf lf',
    'trailing whitespace',
  ],
  icon: 'Eye',
  relatedTools: [],
};

export default meta;
