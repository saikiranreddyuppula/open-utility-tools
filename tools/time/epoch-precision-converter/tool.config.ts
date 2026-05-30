import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-epoch-precision-converter-v1',
  name: 'Epoch Precision Converter',
  slug: 'epoch-precision-converter',
  description: 'Convert a Unix timestamp between seconds, milliseconds, microseconds, and nanoseconds with auto-detection.',
  category: 'time',
  tags: ['epoch', 'timestamp', 'unix', 'nanoseconds', 'precision'],
  keywords: ['epoch converter', 'unix timestamp', 'milliseconds', 'microseconds', 'nanoseconds', 'auto detect'],
  icon: 'Clock',
  relatedTools: [],
};

export default meta;
