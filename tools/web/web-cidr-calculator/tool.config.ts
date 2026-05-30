import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-cidr-calculator-v1',
  name: 'CIDR / IP Range Calculator',
  slug: 'web-cidr-calculator',
  description: 'Expand an IPv4/IPv6 CIDR block into network, broadcast, mask, and host range.',
  category: 'web',
  tags: ['cidr', 'ip', 'subnet', 'network', 'ipv6'],
  keywords: ['netmask', 'broadcast', 'wildcard', 'host range', 'prefix', 'subnetting', 'ipv4'],
  icon: 'Network',
  relatedTools: [],
};

export default meta;
