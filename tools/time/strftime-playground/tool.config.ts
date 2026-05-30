import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-strftime-playground-v1',
  name: 'strftime Format Playground',
  slug: 'strftime-playground',
  description:
    'Apply a C/Python strftime format string to a chosen datetime and see the rendered output live.',
  category: 'time',
  tags: ['strftime', 'date format', 'python', 'playground', 'format'],
  keywords: [
    'strftime',
    'date format',
    'python datetime',
    'format directives',
    'percent y',
    'time format',
  ],
  icon: 'Code',
  relatedTools: [],
};

export default meta;
