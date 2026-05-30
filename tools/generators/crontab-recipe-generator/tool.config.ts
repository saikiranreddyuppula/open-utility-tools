import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-crontab-recipe-generator-v1',
  name: 'Crontab Recipe Generator',
  slug: 'crontab-recipe-generator',
  description: 'Generate a full crontab file with multiple jobs, schedule presets, env lines, and human comments.',
  category: 'generators',
  tags: ['cron', 'crontab', 'scheduler', 'linux', 'devops'],
  keywords: ['crontab', 'cron file', 'cron jobs', 'scheduler', 'cron expression', 'cronjob'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
