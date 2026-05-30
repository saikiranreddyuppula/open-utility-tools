import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-mimetype-from-extension-v1',
  name: 'MIME Type from Extension',
  slug: 'web-mimetype-from-extension',
  description: 'Map one or many file extensions or filenames to their canonical MIME types and back.',
  category: 'web',
  tags: ['mime', 'content-type', 'extension', 'filename', 'lookup'],
  keywords: ['mime type', 'content type', 'file extension', 'filename', 'media type', 'octet-stream', 'iana', 'reverse mime'],
  icon: 'FileSearch',
  relatedTools: [],
};

export default meta;
