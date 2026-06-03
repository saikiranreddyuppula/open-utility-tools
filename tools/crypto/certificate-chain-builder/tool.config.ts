import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "crypto-certificate-chain-builder-v1",
  name: "Certificate Chain Builder",
  slug: "certificate-chain-builder",
  description: "Inspect pasted PEM certificate chains and flag ordering, duplicate subjects, and missing intermediates.",
  category: "crypto",
  tags: ["certificate","chain","tls","pem"],
  keywords: ["certificate","chain","tls","pem"],
  icon: "FileStack",
  relatedTools: [],
};

export default meta;
