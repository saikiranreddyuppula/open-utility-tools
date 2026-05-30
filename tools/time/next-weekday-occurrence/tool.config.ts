import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-next-weekday-occurrence-v1',
  name: 'Next Weekday Occurrence',
  slug: 'next-weekday-occurrence',
  description: 'Find the next (or Nth) date that falls on a chosen weekday from a starting date.',
  category: 'time',
  tags: ['weekday', 'date', 'calendar', 'next', 'occurrence'],
  keywords: ['next monday', 'nth weekday', 'next weekday', 'upcoming day', 'find weekday date'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
