import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-random-date-v1',
  name: 'Random Date Generator',
  slug: 'generate-random-date',
  description:
    'Generate random dates and times between a start and end bound, with chosen output format (ISO, locale, Unix timestamp) and quantity for seeding data.',
  category: 'generators',
  tags: ['date', 'random', 'generator'],
  keywords: ['date', 'random', 'time', 'timestamp', 'iso', 'seed'],
  icon: 'Calendar',
  relatedTools: [],
};

export default meta;
