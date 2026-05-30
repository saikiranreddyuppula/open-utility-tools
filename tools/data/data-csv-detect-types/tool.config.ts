import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-data-csv-detect-types-v1',
  name: 'CSV Column Type Detector',
  slug: 'data-csv-detect-types',
  description: "Infers each CSV column's data type (integer, float, boolean, date, string) from its values.",
  category: 'data',
  tags: ['csv', 'types', 'schema', 'inference'],
  keywords: ['csv', 'type', 'detect', 'infer', 'schema', 'sql', 'typescript', 'column', 'data type'],
  icon: 'TableProperties',
  relatedTools: [],
};

export default meta;
