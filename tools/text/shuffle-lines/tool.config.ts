import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-shuffle-lines-v1',
  name: 'Shuffle Lines',
  slug: 'shuffle-lines',
  description:
    'Randomly shuffle the order of lines, with an option to pick a random subset or a single random line.',
  category: 'text',
  tags: ['shuffle', 'randomize', 'lines'],
  keywords: ['shuffle', 'randomize', 'random order', 'lines', 'scramble'],
  icon: 'Shuffle',
  relatedTools: [],
};

export default meta;
