import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'pdf-image-to-pdf-v1',
  name: 'Image to PDF',
  slug: 'image-to-pdf',
  description: 'Combine JPG, PNG & other images into a single PDF — one image per page, entirely in your browser.',
  category: 'pdf',
  tags: ['pdf', 'image', 'convert', 'jpg', 'png'],
  keywords: [
    'image to pdf',
    'jpg to pdf',
    'jpeg to pdf',
    'png to pdf',
    'photos to pdf',
    'images to pdf',
    'convert image to pdf',
    'picture to pdf',
  ],
  icon: 'FileImage',
  relatedTools: ['merge-pdf', 'split-pdf', 'rotate-pdf', 'image-converter'],
};

export default meta;
