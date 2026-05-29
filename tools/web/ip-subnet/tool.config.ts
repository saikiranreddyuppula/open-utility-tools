import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-ip-subnet-v1',
  name: 'IPv4 Subnet Calculator',
  slug: 'ip-subnet-calculator',
  description: 'Compute network, broadcast, mask, host range and count from CIDR.',
  category: 'web',
  tags: ['ip', 'subnet', 'cidr', 'network', 'netmask'],
  keywords: ['subnet calculator', 'cidr', 'ipv4', 'netmask', 'network address', 'broadcast', 'host range'],
  icon: 'Network',
  relatedTools: ['number-base-converter', 'url-parser', 'mime-types'],
};

export default meta;
