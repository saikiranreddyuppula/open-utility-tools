import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-cron-expression-v1',
  name: 'Cron Expression Builder',
  slug: 'generate-cron-expression',
  description:
    'Build a cron expression from human-friendly schedule controls (minute, hour, day, month, weekday) and see a plain-English description of when it runs.',
  category: 'generators',
  tags: ['cron', 'schedule', 'generator'],
  keywords: ['cron', 'schedule', 'crontab', 'builder', 'expression', 'job'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
