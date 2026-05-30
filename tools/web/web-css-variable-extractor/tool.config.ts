import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-css-variable-extractor-v1',
  name: 'CSS Custom Property Extractor',
  slug: 'web-css-variable-extractor',
  description:
    'Extract all CSS custom properties (--var declarations) from a stylesheet into a deduplicated, sortable list.',
  category: 'web',
  tags: ['css', 'variables', 'custom-properties', 'extract', 'tokens'],
  keywords: [
    'css variables',
    'custom properties',
    '--var',
    ':root',
    'design tokens',
    'extract',
    'json',
  ],
  icon: 'Variable',
  relatedTools: [],
};

export default meta;
