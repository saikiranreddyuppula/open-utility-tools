import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-data-transfer-time-calculator-v1',
  name: 'Download / Transfer Time Calculator',
  slug: 'data-transfer-time-calculator',
  description: 'Estimate how long a file takes to transfer at a given connection speed.',
  category: 'convert',
  tags: ['download', 'transfer', 'bandwidth', 'speed', 'time'],
  keywords: ['download time', 'transfer time', 'mbps', 'connection speed', 'file size time', 'throughput'],
  icon: 'Download',
  relatedTools: [],
};

export default meta;
