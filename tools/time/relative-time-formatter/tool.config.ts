import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-relative-time-formatter-v1',
  name: 'Relative Time Formatter',
  slug: 'relative-time-formatter',
  description:
    "Turn a timestamp or date into human-friendly relative phrasing like '3 hours ago' or 'in 2 days' across locales.",
  category: 'time',
  tags: ['relative time', 'ago', 'intl'],
  keywords: ['relative time', 'ago', 'time since', 'intl', 'human readable'],
  icon: 'Clock',
  relatedTools: [],
};

export default meta;
