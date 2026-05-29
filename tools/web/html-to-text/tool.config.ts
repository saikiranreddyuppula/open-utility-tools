import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-html-to-text-v1',
  name: 'HTML to Text',
  slug: 'html-to-text',
  description: 'Strip HTML tags and decode entities to get clean plain text.',
  category: 'web',
  tags: ['html', 'strip tags', 'plain text', 'extract'],
  keywords: ['html to text', 'strip tags', 'remove html', 'plain text', 'extract text'],
  icon: 'FileCode',
  relatedTools: ['html-entities', 'markdown-to-html', 'whitespace-cleaner'],
};

export default meta;
