import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-working-hours-calculator-v1',
  name: 'Working Hours Calculator',
  slug: 'working-hours-calculator',
  description: 'Compute net working hours between two datetimes, excluding nights, weekends, and lunch.',
  category: 'time',
  tags: ['working hours', 'business hours', 'timesheet', 'payroll', 'duration'],
  keywords: ['work hours', 'billable hours', 'business hours', 'lunch break', 'weekday hours', 'timesheet'],
  icon: 'Briefcase',
  relatedTools: [],
};

export default meta;
