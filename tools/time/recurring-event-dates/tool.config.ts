import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-recurring-event-dates-v1',
  name: 'Recurring Event Date Generator',
  slug: 'recurring-event-dates',
  description: 'Generate the next N dates for a simple recurrence (daily, weekly, monthly, yearly with interval).',
  category: 'time',
  tags: ['recurrence', 'schedule', 'dates', 'rrule', 'generator'],
  keywords: ['recurring dates', 'every N days', 'weekly schedule', 'monthly recurrence', 'rrule', 'occurrences'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
