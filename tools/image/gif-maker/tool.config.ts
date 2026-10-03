import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-gif-maker-v1',
  name: 'GIF Maker',
  slug: 'gif-maker',
  description:
    'Create animated GIFs from images or a short video clip, with frame delays, looping, ping-pong, dithering and size optimisation.',
  category: 'image',
  tags: ['gif', 'animation', 'video', 'frames', 'slideshow'],
  keywords: [
    'animated gif maker',
    'images to gif',
    'video to gif',
    'gif creator',
    'boomerang gif',
    'ping pong gif',
    'gif encoder',
    'make gif online',
    'frame delay',
    'gif loop',
    'optimize gif',
  ],
  icon: 'Images',
  relatedTools: ['image-converter', 'image-resize-pixels', 'image-compress-quality', 'image-sprite-splitter'],
};

export default meta;
