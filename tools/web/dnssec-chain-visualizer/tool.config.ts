import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-dnssec-chain-visualizer-v1",
  name: "DNSSEC Chain Visualizer",
  slug: "dnssec-chain-visualizer",
  description: "Inspect pasted DS, DNSKEY, RRSIG, and NSEC records and outline the trust chain.",
  category: "web",
  tags: ["dnssec","dns","security","records"],
  keywords: ["dnssec","dns","security","records"],
  icon: "ShieldCheck",
  relatedTools: [],
};

export default meta;
