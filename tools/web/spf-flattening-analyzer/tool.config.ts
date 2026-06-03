import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-spf-flattening-analyzer-v1",
  name: "SPF Flattening Analyzer",
  slug: "spf-flattening-analyzer",
  description: "Count SPF mechanisms and estimate DNS lookup pressure before flattening.",
  category: "web",
  tags: ["spf","dns","email","analysis"],
  keywords: ["spf","dns","email","analysis"],
  icon: "FileSearch",
  relatedTools: [],
};

export default meta;
