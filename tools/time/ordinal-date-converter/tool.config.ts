import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-ordinal-date-converter-v1',
  name: 'Ordinal Date Converter',
  slug: 'ordinal-date-converter',
  description:
    'Convert between calendar dates and ordinal dates (year + day-of-year, YYYY-DDD).',
  category: 'time',
  tags: ['ordinal date', 'day of year', 'iso 8601', 'calendar', 'convert'],
  keywords: [
    'ordinal date',
    'yyyy-ddd',
    'day of year',
    'julian day',
    'iso ordinal',
    'date to ordinal',
  ],
  icon: 'ListOrdered',
  relatedTools: [],
};

export default meta;
