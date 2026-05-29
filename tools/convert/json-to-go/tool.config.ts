import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-json-to-go-v1',
  name: 'JSON to Go Struct',
  slug: 'json-to-go',
  description: 'Infer Go structs (with json tags) from a JSON sample.',
  category: 'convert',
  tags: ['json', 'go', 'golang', 'struct', 'codegen'],
  keywords: ['json to go', 'go struct', 'golang struct', 'json tags', 'codegen'],
  icon: 'FileCode',
  relatedTools: ['json-to-typescript', 'json-formatter', 'json-to-xml'],
};

export default meta;
