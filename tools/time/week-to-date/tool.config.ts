import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-week-to-date-v1',
  name: 'Week Number to Date',
  slug: 'week-to-date',
  description:
    'Convert an ISO week number and year into the start and end dates of that week, and vice versa.',
  category: 'time',
  tags: ['iso week', 'week number', 'calendar'],
  keywords: ['iso week', 'week number', 'week date', 'convert', 'calendar'],
  icon: 'Calendar',
  relatedTools: [],
};

export default meta;
