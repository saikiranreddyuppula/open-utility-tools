import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-timezone-v1',
  name: 'Timezone Converter',
  slug: 'timezone-converter',
  description: 'Convert a date/time across timezones using the browser’s IANA database.',
  category: 'time',
  tags: ['timezone', 'time', 'convert', 'utc', 'iana'],
  keywords: ['timezone converter', 'utc', 'time zones', 'world clock', 'convert time'],
  icon: 'Clock',
  relatedTools: ['timestamp-converter', 'date-difference', 'cron-parser'],
};

export default meta;
