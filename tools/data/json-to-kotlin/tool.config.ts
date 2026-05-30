import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-kotlin-v1',
  name: 'JSON to Kotlin Data Class',
  slug: 'json-to-kotlin',
  description: 'Generate Kotlin data classes with kotlinx.serialization from JSON.',
  category: 'data',
  tags: ['json', 'kotlin', 'data class', 'serialization', 'codegen'],
  keywords: ['json to kotlin', 'data class', 'kotlinx serialization', 'serialname', 'codegen'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
