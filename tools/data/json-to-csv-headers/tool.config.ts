import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-csv-headers-v1',
  name: 'JSON Keys to CSV Header',
  slug: 'json-to-csv-headers',
  description: 'Derive a unified CSV/flat header row from JSON array of objects.',
  category: 'data',
  tags: ['json', 'csv', 'headers', 'keys', 'flatten'],
  keywords: ['json keys', 'csv header', 'union keys', 'field map', 'header row', 'sparse keys'],
  icon: 'TableProperties',
  relatedTools: [],
};

export default meta;
