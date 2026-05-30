import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-time-of-day-bucketer-v1',
  name: 'Time-of-Day Classifier',
  slug: 'time-of-day-bucketer',
  description: 'Classify a time into parts of day (morning, afternoon, evening, night) and solar/clock segments.',
  category: 'time',
  tags: ['time of day', 'morning', 'evening', 'greeting', 'classify'],
  keywords: [
    'part of day',
    'morning afternoon evening night',
    'good morning',
    'time bucket',
    'time segment',
    'clock period',
  ],
  icon: 'Sun',
  relatedTools: [],
};

export default meta;
