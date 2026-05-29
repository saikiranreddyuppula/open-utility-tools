import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-iso-duration-parser-v1',
  name: 'ISO 8601 Duration Parser',
  slug: 'iso-duration-parser',
  description:
    'Parse ISO 8601 duration strings like P1Y2M10DT2H30M into total seconds and a human-readable breakdown.',
  category: 'time',
  tags: ['iso 8601', 'duration', 'period', 'parse'],
  keywords: ['iso 8601', 'duration', 'P1Y', 'period', 'parse'],
  icon: 'Timer',
  relatedTools: [],
};

export default meta;
