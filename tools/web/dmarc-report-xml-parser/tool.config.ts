import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-dmarc-report-xml-parser-v1",
  name: "DMARC Report XML Parser",
  slug: "dmarc-report-xml-parser",
  description: "Parse aggregate DMARC XML reports into source IPs, counts, dispositions, and auth results.",
  category: "web",
  tags: ["dmarc","xml","email","reports"],
  keywords: ["dmarc","xml","email","reports"],
  icon: "FileSearch",
  relatedTools: [],
};

export default meta;
