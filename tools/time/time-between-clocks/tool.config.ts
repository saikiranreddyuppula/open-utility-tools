import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-time-between-clocks-v1',
  name: 'Clock Time Difference',
  slug: 'time-between-clocks',
  description:
    'Compute the duration between two times of day, optionally wrapping past midnight.',
  category: 'time',
  tags: ['duration', 'clock', 'shift', 'difference', 'overnight'],
  keywords: [
    'time difference',
    'shift length',
    'hours worked',
    'overnight duration',
    'clock math',
    'elapsed time',
  ],
  icon: 'Clock3',
  relatedTools: [],
};

export default meta;
