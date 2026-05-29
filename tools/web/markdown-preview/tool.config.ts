import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-markdown-preview-v1',
  name: 'Markdown to HTML',
  slug: 'markdown-to-html',
  description: 'Render Markdown to HTML with a live preview and copyable output.',
  category: 'web',
  tags: ['markdown', 'md', 'html', 'preview', 'render'],
  keywords: ['markdown', 'md to html', 'preview', 'render markdown', 'gfm'],
  icon: 'FileCode',
  relatedTools: ['html-to-text', 'html-entities', 'json-formatter'],
};

export default meta;
