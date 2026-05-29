import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-ts-v1',
  name: 'JSON to TypeScript',
  slug: 'json-to-typescript',
  description: 'Infer TypeScript interfaces from a JSON sample.',
  category: 'data',
  tags: ['json', 'typescript', 'types', 'interface', 'codegen'],
  keywords: ['json to typescript', 'json to types', 'interface', 'codegen', 'dto'],
  icon: 'FileCode',
  relatedTools: ['json-formatter', 'json-to-csv', 'csv-to-json'],
};

export default meta;
