import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'crypto-crypto-bcrypt-cost-benchmark-v1',
  name: 'Bcrypt Cost Estimator',
  slug: 'crypto-bcrypt-cost-benchmark',
  description: 'Estimate bcrypt hashing time for each cost factor and recommend a target work factor.',
  category: 'crypto',
  tags: ['bcrypt', 'cost', 'work-factor', 'password', 'benchmark'],
  keywords: ['bcrypt', 'cost factor', 'work factor', 'rounds', 'password hashing', 'benchmark', 'tuning'],
  icon: 'Gauge',
  relatedTools: [],
};

export default meta;
