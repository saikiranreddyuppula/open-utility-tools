import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-random-date-range-generator-v1',
  name: 'Random Datetime Generator',
  slug: 'random-date-range-generator',
  description:
    'Generate random dates and timestamps within a range, in your chosen format.',
  category: 'generators',
  tags: ['date', 'datetime', 'timestamp', 'random', 'range', 'iso8601'],
  keywords: [
    'random date',
    'unix timestamp',
    'epoch',
    'iso 8601',
    'date generator',
    'sample dates',
    'business days',
  ],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
