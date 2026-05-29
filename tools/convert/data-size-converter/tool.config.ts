import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-data-size-converter-v1',
  name: 'Data Size Converter',
  slug: 'data-size-converter',
  description:
    'Convert digital storage between bits, bytes, KB/MB/GB/TB and KiB/MiB/GiB, clearly separating decimal SI and binary IEC units.',
  category: 'convert',
  tags: ['bytes', 'data size', 'gigabyte', 'gibibyte', 'convert'],
  keywords: ['bytes', 'data size', 'gigabyte', 'gibibyte', 'convert', 'storage'],
  icon: 'Database',
  relatedTools: [],
};

export default meta;
