import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-to-base64-v1',
  name: 'Image to Base64',
  slug: 'image-to-base64',
  description: 'Encode an image to a Base64 data-URI for inline use in CSS/HTML/JSON.',
  category: 'image',
  tags: ['base64', 'data uri', 'image', 'inline', 'css'],
  keywords: ['image to base64', 'data uri', 'inline image', 'embed image', 'css background'],
  icon: 'FileImage',
  relatedTools: ['image-converter', 'base64-text', 'image-favicon-generator'],
};

export default meta;
