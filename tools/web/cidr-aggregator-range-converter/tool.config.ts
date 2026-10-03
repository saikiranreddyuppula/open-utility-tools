import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-cidr-aggregator-range-converter-v1',
  name: 'CIDR Aggregator & IP Range Converter',
  slug: 'cidr-aggregator-range-converter',
  description:
    'Merge, subtract, intersect, split and convert IPv4/IPv6 CIDR lists and IP ranges, then export as nginx, Apache, iptables, nftables, ipset or AWS rules.',
  category: 'web',
  tags: ['cidr', 'ip', 'aggregate', 'range', 'ipv6', 'firewall'],
  keywords: [
    'summarize',
    'supernet',
    'collapse',
    'merge cidr',
    'ip range to cidr',
    'cidr to range',
    'subtract',
    'exclude private',
    'netmask',
    'allowlist',
    'ipset',
    'nftables',
    'iptables',
    'overlap',
    'subnet split',
  ],
  icon: 'Combine',
  relatedTools: ['web-cidr-calculator', 'web-ip-cidr-membership', 'ip-subnet-calculator', 'web-ipv6-expander'],
};

export default meta;
