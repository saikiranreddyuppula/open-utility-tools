import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-to-data-uri-variants-v1',
  name: 'Image to Data URI (CSS/HTML/JSX)',
  slug: 'image-to-data-uri-variants',
  description: 'Encode an image as a base64 data URI and wrap it for CSS, HTML img, Markdown, or JSX.',
  category: 'image',
  tags: ['data-uri', 'base64', 'css', 'embed', 'inline'],
  keywords: [
    'data uri',
    'base64 image',
    'inline image',
    'css background-image',
    'html img',
    'jsx snippet',
  ],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
