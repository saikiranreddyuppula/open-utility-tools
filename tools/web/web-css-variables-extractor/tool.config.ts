import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-css-variables-extractor-v1',
  name: 'CSS Custom Properties Extractor',
  slug: 'web-css-variables-extractor',
  description:
    'Scan CSS and list all --custom-properties and var() usages with values.',
  category: 'web',
  tags: ['css', 'variables', 'var', 'audit', 'custom-properties'],
  keywords: [
    'css variables',
    'var()',
    'custom properties',
    'usage audit',
    'undeclared',
    'unused',
    'design tokens',
  ],
  icon: 'Variable',
  relatedTools: [],
};

export default meta;
