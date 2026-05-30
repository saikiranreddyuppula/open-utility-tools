import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-weekday-of-date-v1',
  name: 'Weekday of Any Date',
  slug: 'weekday-of-date',
  description: 'Find which day of the week any date falls on, with a Doomsday-rule mental-math walkthrough.',
  category: 'time',
  tags: ['weekday', 'doomsday', 'zeller', 'day of week', 'calendar'],
  keywords: [
    'day of the week',
    'what day was',
    'zeller congruence',
    'doomsday rule',
    'conway',
    'weekday calculator',
  ],
  icon: 'CalendarDays',
  relatedTools: [],
};

export default meta;
