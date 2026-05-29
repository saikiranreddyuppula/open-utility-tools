import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-cron-explainer-v1',
  name: 'Cron Expression Explainer',
  slug: 'web-cron-explainer',
  description:
    'Translate a cron expression into plain English and list the next several run times, supporting ranges, steps, and lists across all five fields.',
  category: 'web',
  tags: ['cron', 'schedule', 'crontab'],
  keywords: ['cron', 'schedule', 'crontab', 'explain', 'next-run', 'expression'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
