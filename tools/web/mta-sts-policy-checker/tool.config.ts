import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-mta-sts-policy-checker-v1",
  name: "MTA-STS Policy Checker",
  slug: "mta-sts-policy-checker",
  description: "Validate MTA-STS TXT and policy file contents for secure inbound mail delivery.",
  category: "web",
  tags: ["mta-sts","email","tls","dns"],
  keywords: ["mta-sts","email","tls","dns"],
  icon: "ShieldCheck",
  relatedTools: [],
};

export default meta;
