import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-security-headers-auditor-v1",
  name: "Security Headers Auditor",
  slug: "security-headers-auditor",
  description: "Audit pasted HTTP response headers for CSP, HSTS, frame, MIME, referrer, and permissions policy.",
  category: "web",
  tags: ["security headers","http","csp","audit"],
  keywords: ["security headers","http","csp","audit"],
  icon: "Shield",
  relatedTools: [],
};

export default meta;
