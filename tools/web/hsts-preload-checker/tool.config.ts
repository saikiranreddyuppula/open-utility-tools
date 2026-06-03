import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-hsts-preload-checker-v1",
  name: "HSTS Preload Checker",
  slug: "hsts-preload-checker",
  description: "Check Strict-Transport-Security headers against common preload requirements.",
  category: "web",
  tags: ["hsts","headers","security","tls"],
  keywords: ["hsts","headers","security","tls"],
  icon: "ShieldCheck",
  relatedTools: [],
};

export default meta;
