import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-title-case-v1',
  name: 'Title Case Converter',
  slug: 'title-case',
  description:
    'Apply proper headline title case following style rules that keep small words like a, an, and, the lowercase except as the first or last word.',
  category: 'text',
  tags: ['title case', 'capitalize', 'headline'],
  keywords: ['title case', 'headline', 'capitalize', 'proper case', 'apa'],
  icon: 'Heading',
  relatedTools: [],
};

export default meta;
