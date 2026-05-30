import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'image-image-rgb-channel-split-v1',
  name: 'RGB Channel Splitter',
  slug: 'image-rgb-channel-split',
  description:
    'Split an image into separate red, green, blue, and alpha channel images.',
  category: 'image',
  tags: ['channels', 'rgb', 'split', 'alpha', 'grayscale', 'compositing'],
  keywords: [
    'rgb channel split',
    'color channels',
    'red green blue',
    'alpha mask',
    'channel separation',
    'isolate channel',
  ],
  icon: 'Layers',
  relatedTools: [],
};

export default meta;
