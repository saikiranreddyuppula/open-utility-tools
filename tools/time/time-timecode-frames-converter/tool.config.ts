import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-time-timecode-frames-converter-v1',
  name: 'SMPTE Timecode / Frames Converter',
  slug: 'time-timecode-frames-converter',
  description: 'Converts between SMPTE timecode (HH:MM:SS:FF) and total frame counts at a chosen frame rate.',
  category: 'time',
  tags: ['smpte', 'timecode', 'frames', 'video', 'drop-frame'],
  keywords: [
    'timecode to frames',
    'frames to timecode',
    'drop frame',
    'fps converter',
    'ndf df',
    '29.97',
  ],
  icon: 'Clock3',
  relatedTools: [],
};

export default meta;
