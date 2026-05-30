import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-stats-summary-v1',
  name: 'JSON Structure Stats',
  slug: 'json-stats-summary',
  description: "Summarize a JSON document's structure, depth, and type counts.",
  category: 'data',
  tags: ['json', 'stats', 'analysis', 'structure', 'depth'],
  keywords: ['json stats', 'json analyzer', 'type counts', 'json depth', 'key frequency', 'json schema skeleton'],
  icon: 'ChartBar',
  relatedTools: [],
};

export default meta;
