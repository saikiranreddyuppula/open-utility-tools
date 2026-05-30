import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-pydantic-v1',
  name: 'JSON to Pydantic Model',
  slug: 'json-to-pydantic',
  description: 'Generate Pydantic v2 BaseModel classes from a JSON sample.',
  category: 'data',
  tags: ['json', 'pydantic', 'python', 'codegen', 'model'],
  keywords: [
    'json to pydantic',
    'basemodel',
    'pydantic v2',
    'python model',
    'json schema',
    'dto',
  ],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
