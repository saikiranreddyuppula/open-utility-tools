import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-word-wrap-justify-v1',
  name: 'Paragraph Reflow & Justify',
  slug: 'word-wrap-justify',
  description:
    'Re-wrap paragraphs to a target width with left, right, center, or full-justify alignment and hyphenation control.',
  category: 'text',
  tags: ['wrap', 'justify', 'reflow', 'align', 'paragraph'],
  keywords: [
    'word wrap',
    'reflow text',
    'full justify',
    'text alignment',
    'column width',
    'fill paragraph',
  ],
  icon: 'AlignJustify',
  relatedTools: [],
};

export default meta;
