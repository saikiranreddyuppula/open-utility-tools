import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-css-specificity-v1',
  name: 'CSS Specificity Calculator',
  slug: 'web-css-specificity',
  description:
    'Compute the specificity of any CSS selector as an (a,b,c) triple and rank multiple selectors to predict which rule wins.',
  category: 'web',
  tags: ['css', 'specificity', 'selector'],
  keywords: ['css', 'specificity', 'selector', 'cascade', 'calculate', 'frontend'],
  icon: 'Calculator',
  relatedTools: [],
};

export default meta;
