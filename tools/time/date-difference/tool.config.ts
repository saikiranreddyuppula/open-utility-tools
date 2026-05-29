import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-date-difference-v1',
  name: 'Date Difference',
  slug: 'date-difference',
  description: 'Calculate the duration between two dates in years, days, hours and more.',
  category: 'time',
  tags: ['date', 'difference', 'duration', 'age', 'between'],
  keywords: ['date difference', 'duration', 'days between', 'age calculator', 'time between'],
  icon: 'Calendar',
  relatedTools: ['timestamp-converter', 'cron-parser', 'percentage-calculator'],
};

export default meta;
