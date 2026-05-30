import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-fixed-offset-timezone-math-v1',
  name: 'Fixed UTC Offset Converter',
  slug: 'fixed-offset-timezone-math',
  description: 'Convert a datetime across fixed UTC offsets (e.g. +05:30 to -08:00) without DST guessing.',
  category: 'time',
  tags: ['utc offset', 'timezone', 'datetime', 'conversion', 'fixed offset'],
  keywords: ['utc offset converter', 'time zone math', 'fixed offset', 'no dst', 'half hour offset', 'gmt'],
  icon: 'Globe',
  relatedTools: [],
};

export default meta;
