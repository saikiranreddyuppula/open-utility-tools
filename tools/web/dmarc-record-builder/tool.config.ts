import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-dmarc-record-builder-v1",
  name: "DMARC Record Builder",
  slug: "dmarc-record-builder",
  description: "Build DMARC TXT policies with reporting URIs, alignment, percentage, and subdomain policy.",
  category: "web",
  tags: ["dmarc","dns","email","txt"],
  keywords: ["dmarc","dns","email","txt"],
  icon: "Mail",
  relatedTools: [],
};

export default meta;
