import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-iso-8601-parser-v1',
  name: 'ISO 8601 Parser',
  slug: 'iso-8601-parser',
  description:
    'Break down an ISO 8601 date-time string into its components (year, month, day, hour, offset, week) and validate it.',
  category: 'time',
  tags: ['iso 8601', 'parse', 'datetime', 'validate'],
  keywords: ['iso 8601', 'parse', 'datetime', 'offset', 'validate'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
