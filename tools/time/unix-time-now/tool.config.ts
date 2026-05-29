import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-unix-time-now-v1',
  name: 'Unix Timestamp Now',
  slug: 'unix-time-now',
  description:
    'Live ticking display of the current Unix timestamp in seconds, milliseconds, and microseconds, with a one-click copy and pause toggle.',
  category: 'time',
  tags: ['unix', 'epoch', 'timestamp', 'now'],
  keywords: ['unix', 'epoch', 'current timestamp', 'now', 'milliseconds'],
  icon: 'Clock',
  relatedTools: [],
};

export default meta;
