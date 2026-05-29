import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-week-number-v1',
  name: 'ISO Week Number',
  slug: 'week-number',
  description: 'Find the ISO 8601 week number for any date (and day-of-year).',
  category: 'time',
  tags: ['week number', 'iso 8601', 'date', 'calendar'],
  keywords: ['week number', 'iso week', 'day of year', 'calendar week', 'what week'],
  icon: 'Calendar',
  relatedTools: ['date-difference', 'age-calculator', 'timestamp-converter'],
};

export default meta;
