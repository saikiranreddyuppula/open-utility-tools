import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-paragraph-splitter-v1',
  name: 'Paragraph Splitter & Joiner',
  slug: 'paragraph-splitter',
  description:
    'Split text into separated paragraphs or rejoin wrapped lines into paragraphs.',
  category: 'text',
  tags: ['paragraph', 'split', 'join', 'unwrap', 'reflow'],
  keywords: [
    'paragraph splitter',
    'join lines',
    'unwrap text',
    'rewrap',
    'hard wrap',
    'blank lines',
    'reflow',
  ],
  icon: 'Pilcrow',
  relatedTools: [],
};

export default meta;
