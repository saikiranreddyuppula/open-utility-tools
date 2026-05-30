import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-ip-cidr-membership-v1',
  name: 'IP-in-CIDR Checker',
  slug: 'web-ip-cidr-membership',
  description: 'Check whether IP addresses fall within one or more CIDR ranges.',
  category: 'web',
  tags: ['ip', 'cidr', 'subnet', 'network', 'match'],
  keywords: ['ip in range', 'cidr contains', 'subnet membership', 'ipv4', 'ipv6', 'prefix mask', 'overlap'],
  icon: 'Target',
  relatedTools: [],
};

export default meta;
