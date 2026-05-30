import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-protobuf-v1',
  name: 'JSON to Protobuf',
  slug: 'json-to-protobuf',
  description: 'Generate a proto3 .proto message definition from a JSON sample.',
  category: 'data',
  tags: ['json', 'protobuf', 'proto3', 'grpc', 'codegen'],
  keywords: ['json to protobuf', 'proto3', 'proto file', 'message definition', 'grpc', 'codegen'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
