import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-business-days-calculator-v1',
  name: 'Business Days Calculator',
  slug: 'business-days-calculator',
  description:
    'Count working days between two dates, excluding weekends, or add a number of business days to a start date.',
  category: 'time',
  tags: ['business days', 'working days', 'weekdays'],
  keywords: ['business days', 'working days', 'weekdays', 'exclude weekends', 'calculate'],
  icon: 'Calendar',
  relatedTools: [],
};

export default meta;
