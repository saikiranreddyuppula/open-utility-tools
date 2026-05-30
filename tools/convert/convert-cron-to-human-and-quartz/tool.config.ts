import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-convert-cron-to-human-and-quartz-v1',
  name: 'Cron Dialect Translator',
  slug: 'convert-cron-to-human-and-quartz',
  description:
    'Converts between standard 5-field cron and 6/7-field Quartz/Spring cron expressions.',
  category: 'convert',
  tags: ['cron', 'quartz', 'spring', 'schedule', 'convert'],
  keywords: ['cron', 'quartz', 'spring', 'unix cron', 'seconds field', 'day of week', 'translate'],
  icon: 'CalendarClock',
  relatedTools: [],
};

export default meta;
