import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-cron-parser-v1',
  name: 'Cron Expression Explainer',
  slug: 'cron-parser',
  description: 'Explain a cron expression in plain English and preview the next run times.',
  category: 'time',
  tags: ['cron', 'crontab', 'schedule', 'parser', 'explain'],
  keywords: ['cron', 'crontab', 'schedule', 'cron expression', 'next run', 'explain cron'],
  icon: 'CalendarClock',
  relatedTools: ['timestamp-converter', 'date-difference', 'gitignore-generator'],
};

export default meta;
