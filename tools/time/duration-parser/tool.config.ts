import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-duration-parser-v1',
  name: 'Duration String Parser',
  slug: 'duration-parser',
  description: "Parse human duration text like '1h30m', '2 days 4 hours', or '90s' into total seconds and milliseconds.",
  category: 'time',
  tags: ['duration', 'parser', 'time', 'seconds', 'milliseconds'],
  keywords: ['parse duration', 'human duration', '1h30m', 'time string', 'to seconds', 'to ms'],
  icon: 'Timer',
  relatedTools: [],
};

export default meta;
