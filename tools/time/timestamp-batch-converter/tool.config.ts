import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'time-timestamp-batch-converter-v1',
  name: 'Batch Timestamp Converter',
  slug: 'timestamp-batch-converter',
  description:
    'Convert a pasted list of Unix timestamps to human dates (or dates back to timestamps) in bulk.',
  category: 'time',
  tags: ['timestamp', 'unix', 'batch', 'epoch', 'convert'],
  keywords: [
    'unix timestamp',
    'epoch converter',
    'batch convert',
    'bulk timestamp',
    'log timestamps',
    'iso date',
    'milliseconds',
    'seconds',
  ],
  icon: 'Rows3',
  relatedTools: [],
};

export default meta;
