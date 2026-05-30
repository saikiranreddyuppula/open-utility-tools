import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-unix-nanoseconds-converter-v1',
  name: 'Unix Nanoseconds Converter',
  slug: 'unix-nanoseconds-converter',
  description: 'Convert nanosecond-precision Unix timestamps to date-time and back without floating-point loss.',
  category: 'time',
  tags: ['unix', 'nanoseconds', 'timestamp', 'bigint', 'epoch'],
  keywords: [
    'nanosecond timestamp',
    'unix nanos',
    'epoch ns',
    'high precision time',
    'ns to date',
    'date to nanoseconds',
  ],
  icon: 'Timer',
  relatedTools: [],
};

export default meta;
