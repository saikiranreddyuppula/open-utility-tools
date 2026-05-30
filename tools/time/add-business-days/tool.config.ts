import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-add-business-days-v1',
  name: 'Add Business Days',
  slug: 'add-business-days',
  description:
    'Add or subtract a number of business days to a date, skipping weekends and custom holidays.',
  category: 'time',
  tags: ['business', 'days', 'workdays', 'date', 'holidays'],
  keywords: [
    'add business days',
    'working days',
    'skip weekends',
    'holidays',
    'date offset',
    'deadline calculator',
    'workday',
  ],
  icon: 'CalendarDays',
  relatedTools: [],
};

export default meta;
