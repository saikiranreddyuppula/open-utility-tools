import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-column-extractor-v1',
  name: 'JSON Array Column Pluck',
  slug: 'json-column-extractor',
  description: 'Pluck one or more fields from each object in a JSON array.',
  category: 'data',
  tags: ['json', 'array', 'pluck', 'select', 'columns'],
  keywords: ['json', 'array', 'pluck', 'select', 'extract', 'columns', 'fields', 'project', 'map'],
  icon: 'Columns3',
  relatedTools: [],
};

export default meta;
