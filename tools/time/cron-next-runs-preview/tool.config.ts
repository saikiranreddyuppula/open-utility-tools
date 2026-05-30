import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-cron-next-runs-preview-v1',
  name: 'Cron Next Runs Preview',
  slug: 'cron-next-runs-preview',
  description: 'List the next N execution datetimes for a 5-field cron expression from a chosen start time.',
  category: 'time',
  tags: ['cron', 'schedule', 'preview', 'crontab', 'next-runs'],
  keywords: ['cron next run', 'cron schedule preview', 'crontab', 'fire times', 'next execution', 'cron simulator'],
  icon: 'Repeat',
  relatedTools: [],
};

export default meta;
