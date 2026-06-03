import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-spf-record-builder-v1",
  name: "SPF Record Builder",
  slug: "spf-record-builder",
  description: "Build SPF TXT records from mechanisms, includes, IPv4, IPv6, and all-policy.",
  category: "web",
  tags: ["spf","dns","email","txt"],
  keywords: ["spf","dns","email","txt"],
  icon: "Mail",
  relatedTools: [],
};

export default meta;
