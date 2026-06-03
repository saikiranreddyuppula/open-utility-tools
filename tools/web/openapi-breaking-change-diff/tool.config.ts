import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-openapi-breaking-change-diff-v1",
  name: "OpenAPI Breaking Change Diff",
  slug: "openapi-breaking-change-diff",
  description: "Compare two OpenAPI specs and identify removed paths, methods, parameters, and response codes.",
  category: "web",
  tags: ["openapi","diff","breaking","api"],
  keywords: ["openapi","diff","breaking","api"],
  icon: "GitCompare",
  relatedTools: [],
};

export default meta;
