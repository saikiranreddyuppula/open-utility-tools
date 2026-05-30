import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-content-disposition-builder-v1',
  name: 'Content-Disposition Builder',
  slug: 'web-content-disposition-builder',
  description:
    'Build and parse Content-Disposition headers with RFC 5987 filename encoding.',
  category: 'web',
  tags: ['http', 'header', 'download', 'content-disposition', 'rfc5987'],
  keywords: [
    'content-disposition',
    'attachment',
    'inline',
    'filename',
    'rfc 5987',
    'download header',
    'http header',
  ],
  icon: 'FileOutput',
  relatedTools: [],
};

export default meta;
