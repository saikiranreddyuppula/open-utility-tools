import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-timestamp-converter-v1',
  name: 'Unix Timestamp Converter',
  slug: 'timestamp-converter',
  description: 'Convert between Unix timestamps and human-readable dates (local & UTC).',
  category: 'time',
  tags: ['timestamp', 'unix', 'epoch', 'date', 'iso8601'],
  keywords: ['unix timestamp', 'epoch', 'date converter', 'iso 8601', 'utc', 'milliseconds'],
  icon: 'Clock',
  relatedTools: ['date-difference', 'cron-parser', 'jwt-decoder'],
};

export default meta;
