import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-date-format-converter-v1',
  name: 'Date Format Converter',
  slug: 'date-format-converter',
  description:
    'Parse any date string and reformat it into common patterns (ISO 8601, RFC 2822, US, EU, locale strings) all at once.',
  category: 'time',
  tags: ['date format', 'iso 8601', 'rfc 2822', 'convert'],
  keywords: ['date format', 'iso 8601', 'rfc 2822', 'reformat', 'convert'],
  icon: 'Calendar',
  relatedTools: [],
};

export default meta;
