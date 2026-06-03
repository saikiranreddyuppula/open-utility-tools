import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-dns-zone-file-validator-v1",
  name: "DNS Zone File Validator",
  slug: "dns-zone-file-validator",
  description: "Check zone-file records for common SOA, NS, MX, CNAME, TTL, and syntax issues.",
  category: "web",
  tags: ["dns","zone","records","validation"],
  keywords: ["dns","zone","records","validation"],
  icon: "FileSearch",
  relatedTools: [],
};

export default meta;
