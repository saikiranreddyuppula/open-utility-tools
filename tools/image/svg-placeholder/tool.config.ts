import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-svg-placeholder-v1',
  name: 'Placeholder Image Generator',
  slug: 'placeholder-image',
  description: 'Generate a sized SVG/data-URI placeholder with custom colors and label.',
  category: 'image',
  tags: ['placeholder', 'svg', 'mockup', 'dummy', 'image'],
  keywords: ['placeholder image', 'dummy image', 'svg placeholder', 'mockup', 'placehold'],
  icon: 'ImagePlus',
  relatedTools: ['image-to-base64', 'image-converter', 'favicon-generator'],
};

export default meta;
