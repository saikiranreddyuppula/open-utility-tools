import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-data-attribute-to-dataset-v1',
  name: 'HTML data-* to JS dataset Converter',
  slug: 'web-data-attribute-to-dataset',
  description:
    'Convert data-* attributes to element.dataset access expressions and back.',
  category: 'web',
  tags: ['html', 'dataset', 'data-attribute', 'javascript', 'convert'],
  keywords: [
    'data attribute',
    'dataset',
    'camelcase',
    'kebab-case',
    'data-*',
    'html',
    'javascript',
  ],
  icon: 'Braces',
  relatedTools: [],
};

export default meta;
