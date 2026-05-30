import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-rust-serde-v1',
  name: 'JSON to Rust Structs',
  slug: 'json-to-rust-serde',
  description: 'Generate Rust structs with serde derives from a JSON sample.',
  category: 'data',
  tags: ['json', 'rust', 'serde', 'codegen', 'struct'],
  keywords: [
    'json to rust',
    'serde',
    'rust struct',
    'serialize',
    'deserialize',
    'codegen',
  ],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
