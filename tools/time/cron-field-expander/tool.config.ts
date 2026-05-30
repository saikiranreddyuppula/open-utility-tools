import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-cron-field-expander-v1',
  name: 'Cron Field Expander',
  slug: 'cron-field-expander',
  description: 'Expand each field of a cron expression into the explicit set of matching values.',
  category: 'time',
  tags: ['cron', 'schedule', 'crontab', 'fields', 'expand'],
  keywords: ['cron expression', 'crontab', 'expand cron', 'cron values', 'cron fields', 'fire times'],
  icon: 'ListChecks',
  relatedTools: [],
};

export default meta;
