import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-ip-cidr-list-generator-v1',
  name: 'IP / CIDR Test Range Generator',
  slug: 'ip-cidr-list-generator',
  description:
    'Generate lists of random IPv4/IPv6 addresses or expand a CIDR block into host addresses for test data.',
  category: 'generators',
  tags: ['ip', 'cidr', 'ipv4', 'ipv6', 'test-data'],
  keywords: [
    'ip generator',
    'cidr expand',
    'ipv4',
    'ipv6',
    'random ip',
    'rfc1918',
    'test addresses',
    'subnet hosts',
  ],
  icon: 'Network',
  relatedTools: [],
};

export default meta;
