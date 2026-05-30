import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'data-json-to-csharp-v1',
  name: 'JSON to C# Class',
  slug: 'json-to-csharp',
  description: 'Generate C# classes with System.Text.Json attributes from JSON.',
  category: 'data',
  tags: ['json', 'csharp', 'codegen', 'class', 'dotnet'],
  keywords: ['json to csharp', 'c# class', 'json to c#', 'dotnet model', 'JsonPropertyName', 'POCO'],
  icon: 'FileCode',
  relatedTools: [],
};

export default meta;
