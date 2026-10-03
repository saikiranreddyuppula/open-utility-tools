import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-hex-viewer-file-type-detector-v1',
  name: 'Hex Viewer & File Type Detector',
  slug: 'hex-viewer-file-type-detector',
  description:
    'Open any file (up to multiple GB) in a fast hex editor-style viewer, identify its real type from magic bytes, inspect values as ints and floats, search bytes or text, and see where the data looks compressed or encrypted.',
  category: 'encoding',
  tags: ['hex', 'viewer', 'magic bytes', 'file type', 'entropy', 'binary'],
  keywords: [
    'hex viewer',
    'hex editor',
    'hexdump',
    'file signature',
    'magic number',
    'file type detector',
    'identify file',
    'file extension check',
    'shannon entropy',
    'data inspector',
    'binary viewer',
    'xxd',
    'detect file type',
  ],
  icon: 'Binary',
  relatedTools: ['encoding-base64-to-hex', 'hex-text', 'encoding-utf8-byte-inspector', 'encoding-base64-image-inspector'],
};

export default meta;
