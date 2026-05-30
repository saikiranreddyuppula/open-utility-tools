import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-roman-to-fancy-numbering-v1',
  name: 'List Number Style Converter',
  slug: 'text-roman-to-fancy-numbering',
  description:
    'Renumbers a list using decimal, roman numerals, or letter sequences (a, b, c / A, B, C).',
  category: 'text',
  tags: ['list', 'numbering', 'roman', 'letters', 'renumber'],
  keywords: [
    'renumber list',
    'roman numerals',
    'lettered list',
    'ordered list',
    'list markers',
    'decimal numbering',
    'a b c list',
  ],
  icon: 'ListOrdered',
  relatedTools: [],
};

export default meta;
