import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-days-until-v1',
  name: 'Days Until Date',
  slug: 'days-until',
  description:
    'Count the exact days, weeks, hours, and minutes between today and a target future or past date.',
  category: 'time',
  tags: ['countdown', 'date', 'deadline'],
  keywords: ['countdown', 'days until', 'deadline', 'remaining', 'date diff'],
  icon: 'Calendar',
  relatedTools: [],
};

export default meta;
