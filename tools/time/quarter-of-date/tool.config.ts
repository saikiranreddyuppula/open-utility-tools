import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-quarter-of-date-v1',
  name: 'Quarter & Fiscal Period Finder',
  slug: 'quarter-of-date',
  description:
    'Determine the calendar or fiscal quarter, half, and period dates for any date.',
  category: 'time',
  tags: ['quarter', 'fiscal year', 'calendar', 'finance', 'period'],
  keywords: [
    'quarter',
    'fiscal year',
    'q1 q2 q3 q4',
    'half year',
    'fiscal quarter',
    'period dates',
  ],
  icon: 'ChartPie',
  relatedTools: [],
};

export default meta;
