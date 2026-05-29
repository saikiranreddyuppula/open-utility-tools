import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-generate-mac-address-v1',
  name: 'MAC Address Generator',
  slug: 'generate-mac-address',
  description:
    'Generate random MAC addresses with selectable separator (colon, hyphen, dot), case, and locally-administered/unicast bit control for network testing.',
  category: 'generators',
  tags: ['mac', 'address', 'network'],
  keywords: ['mac', 'address', 'network', 'ethernet', 'hardware', 'random'],
  icon: 'Network',
  relatedTools: [],
};

export default meta;
