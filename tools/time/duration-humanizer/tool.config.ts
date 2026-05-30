import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-duration-humanizer-v1',
  name: 'Duration Humanizer',
  slug: 'duration-humanizer',
  description: "Turn a raw number of seconds or milliseconds into a human phrase like '2 days, 3 hours, 5 minutes'.",
  category: 'time',
  tags: ['duration', 'humanize', 'seconds', 'format', 'time'],
  keywords: ['humanize duration', 'seconds to human', 'milliseconds to time', 'format duration', 'pretty time', 'time ago'],
  icon: 'Hourglass',
  relatedTools: [],
};

export default meta;
