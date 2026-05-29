import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-svg-data-uri-v1',
  name: 'SVG to Data URI',
  slug: 'svg-to-data-uri',
  description: 'Convert raw SVG markup into an optimized data-URI for CSS/HTML.',
  category: 'image',
  tags: ['svg', 'data uri', 'css', 'inline', 'encode'],
  keywords: ['svg to data uri', 'inline svg', 'css background svg', 'url encode svg'],
  icon: 'FileImage',
  relatedTools: ['image-to-base64', 'placeholder-image', 'image-converter'],
};

export default meta;
