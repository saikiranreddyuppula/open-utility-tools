import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-frequency-converter-v1',
  name: 'Frequency Converter',
  slug: 'frequency-converter',
  description: 'Convert frequency between Hz, kHz, MHz, GHz, RPM, and angular rad/s.',
  category: 'convert',
  tags: ['frequency', 'hertz', 'rpm', 'angular', 'bpm', 'physics'],
  keywords: [
    'frequency',
    'hertz',
    'hz',
    'kilohertz',
    'megahertz',
    'gigahertz',
    'rpm',
    'rps',
    'radian per second',
    'angular frequency',
    'bpm',
    'degree per second',
  ],
  icon: 'Activity',
  relatedTools: [],
};

export default meta;
