import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-yaml-anchor-expander-v1',
  name: 'YAML Anchor & Alias Expander',
  slug: 'data-yaml-anchor-expander',
  description: 'Resolve YAML anchors and aliases by inlining their referenced values.',
  category: 'data',
  tags: ['yaml', 'anchor', 'alias', 'merge', 'expand'],
  keywords: [
    'yaml anchor expand',
    'yaml alias resolve',
    'merge key',
    'dereference yaml',
    'inline anchors',
    'flatten yaml',
  ],
  icon: 'Anchor',
  relatedTools: [],
};

export default meta;
