import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-nth-weekday-of-month-v1',
  name: 'Nth Weekday of Month',
  slug: 'nth-weekday-of-month',
  description:
    "Find dates like 'the 3rd Thursday of November' or 'the last Monday of May'.",
  category: 'time',
  tags: ['weekday', 'recurring', 'calendar', 'holidays', 'schedule'],
  keywords: [
    'nth weekday',
    'last monday',
    'third thursday',
    'recurring meeting',
    'thanksgiving',
    'holiday rule',
  ],
  icon: 'Calendar',
  relatedTools: [],
};

export default meta;
