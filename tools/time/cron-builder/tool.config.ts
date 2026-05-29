import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-cron-builder-v1',
  name: 'Cron Expression Builder',
  slug: 'cron-builder',
  description:
    'Build a standard cron expression from dropdowns for minute, hour, day, month, and weekday with a human-readable preview.',
  category: 'time',
  tags: ['cron', 'schedule', 'builder'],
  keywords: ['cron', 'crontab', 'schedule', 'builder', 'expression'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
