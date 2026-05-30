import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-unix-rollover-checker-v1',
  name: 'Time Epoch Rollover Checker',
  slug: 'unix-rollover-checker',
  description: 'Show key time-storage overflow dates (Year 2038, 2-digit Y2K, 32-bit, 64-bit limits).',
  category: 'time',
  tags: ['year 2038', 'epoch', 'overflow', 'unix time', 'reference'],
  keywords: ['Y2038', 'Y2K', '32-bit time_t', '64-bit', 'NTP rollover', 'GPS week', 'FILETIME', 'overflow'],
  icon: 'TrendingUp',
  relatedTools: [],
};

export default meta;
