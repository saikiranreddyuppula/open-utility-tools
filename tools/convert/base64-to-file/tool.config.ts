import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-base64-to-file-v1',
  name: 'Base64 / Data URI to File',
  slug: 'base64-to-file',
  description: 'Decode base64 or a data URI and save it as a named file.',
  category: 'convert',
  tags: ['base64', 'data uri', 'decode', 'file', 'download'],
  keywords: ['base64 to file', 'data uri', 'decode base64', 'blob', 'download', 'mime', 'binary'],
  icon: 'FileOutput',
  relatedTools: [],
};

export default meta;
