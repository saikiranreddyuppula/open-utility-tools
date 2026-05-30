import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-bem-class-generator-v1',
  name: 'BEM Class Name Generator',
  slug: 'web-bem-class-generator',
  description:
    'Generate Block__Element--Modifier CSS class names from block, element and modifier inputs with HTML/CSS preview.',
  category: 'web',
  tags: ['css', 'bem', 'naming', 'generator', 'frontend'],
  keywords: [
    'bem',
    'block element modifier',
    'css class names',
    'naming convention',
    'css methodology',
    'kebab-case',
  ],
  icon: 'Component',
  relatedTools: [],
};

export default meta;
