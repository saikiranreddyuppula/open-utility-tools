import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-mime-types-v1',
  name: 'MIME Type Lookup',
  slug: 'mime-types',
  description: 'Look up the MIME/content type for a file extension and vice versa.',
  category: 'web',
  tags: ['mime', 'content type', 'extension', 'reference'],
  keywords: ['mime type', 'content type', 'file extension', 'media type', 'lookup'],
  icon: 'FileType',
  relatedTools: ['http-status-codes', 'image-to-base64', 'url-parser'],
};

export default meta;
