import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-countdown-timer-builder-v1',
  name: 'Countdown Snapshot Builder',
  slug: 'countdown-timer-builder',
  description:
    'Compute the exact remaining time from now to a target datetime, broken into units.',
  category: 'time',
  tags: ['countdown', 'timer', 'remaining', 'duration', 'deadline'],
  keywords: [
    'countdown',
    'time remaining',
    'time until',
    'days until',
    'deadline',
    'duration breakdown',
    'event timer',
  ],
  icon: 'Hourglass',
  relatedTools: [],
};

export default meta;
