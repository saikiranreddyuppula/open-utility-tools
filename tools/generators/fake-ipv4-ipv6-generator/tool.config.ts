import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-fake-ipv4-ipv6-generator-v1',
  name: 'Random IP Address Generator',
  slug: 'fake-ipv4-ipv6-generator',
  description:
    'Generate random IPv4 and IPv6 addresses, optionally restricted to private or public ranges.',
  category: 'generators',
  tags: ['ip', 'ipv4', 'ipv6', 'network', 'random'],
  keywords: ['ip address', 'random ip', 'cidr', 'rfc1918', 'test data', 'fake ip', 'subnet'],
  icon: 'Network',
  relatedTools: [],
};

export default meta;
