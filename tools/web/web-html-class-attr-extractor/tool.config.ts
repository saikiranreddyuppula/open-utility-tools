import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-html-class-attr-extractor-v1',
  name: 'HTML Class & ID Extractor',
  slug: 'web-html-class-attr-extractor',
  description:
    'Extract every unique class name and id used in an HTML snippet and output them as a sorted list or CSS stub.',
  category: 'web',
  tags: ['html', 'css', 'class', 'id', 'extract'],
  keywords: ['class names', 'id selectors', 'css stub', 'selector list', 'unique classes', 'dom parser'],
  icon: 'Tags',
  relatedTools: [],
};

export default meta;
