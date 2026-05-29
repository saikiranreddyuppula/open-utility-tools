import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-json-to-java-v1',
  name: 'JSON to Java Class',
  slug: 'web-json-to-java',
  description:
    'Convert a JSON payload into POJO Java class definitions with typed fields and getters/setters, inferring nested classes and collection generics.',
  category: 'web',
  tags: ['json', 'java', 'codegen'],
  keywords: ['json', 'java', 'pojo', 'class', 'codegen', 'model'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
