import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'encoding-encoding-base64-image-inspector-v1',
  name: 'Base64 / Data URI Image Inspector',
  slug: 'encoding-base64-image-inspector',
  description: 'Decode a Base64 or data: URI image string and report its real format, dimensions, and size.',
  category: 'encoding',
  tags: ['base64', 'data-uri', 'image', 'inspector', 'magic-bytes'],
  keywords: ['base64 image', 'data uri', 'decode image', 'magic bytes', 'image dimensions', 'mime sniff'],
  icon: 'FileImage',
  relatedTools: [],
};

export default meta;
