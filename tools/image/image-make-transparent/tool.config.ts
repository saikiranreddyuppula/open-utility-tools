import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-make-transparent-v1',
  name: 'Make Background Transparent',
  slug: 'image-make-transparent',
  description:
    'Remove a solid background colour (white product shots, logos, signatures) with a magic-wand style picker, tolerance, soft edges and defringe — then export a transparent PNG or WebP.',
  category: 'image',
  tags: ['transparent', 'background', 'remove', 'png', 'magic-wand'],
  keywords: [
    'remove white background',
    'make png transparent',
    'color to alpha',
    'background remover',
    'chroma key',
    'transparent logo',
    'signature transparent',
    'flood fill',
  ],
  icon: 'Eraser',
  relatedTools: ['image-converter', 'image-crop-aspect', 'image-png-compressor'],
};

export default meta;
