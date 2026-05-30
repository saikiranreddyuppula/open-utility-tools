import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-swift-codable-v1',
  name: 'JSON to Swift Codable',
  slug: 'json-to-swift-codable',
  description: 'Generate Swift structs conforming to Codable from a JSON sample.',
  category: 'data',
  tags: ['json', 'swift', 'codable', 'codegen', 'struct'],
  keywords: [
    'json to swift',
    'codable',
    'swift struct',
    'codingkeys',
    'decodable',
    'codegen',
  ],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
