import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-python-dataclass-v1',
  name: 'JSON to Python Dataclass',
  slug: 'json-to-python-dataclass',
  description: 'Generate Python @dataclass definitions from a JSON sample.',
  category: 'data',
  tags: ['json', 'python', 'dataclass', 'codegen', 'types'],
  keywords: [
    'json to dataclass',
    'python dataclass',
    'json to python',
    'codegen',
    'typing',
    'dto',
  ],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
