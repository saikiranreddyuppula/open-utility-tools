import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-soap-fault-parser-v1",
  name: "SOAP Fault Parser",
  slug: "soap-fault-parser",
  description: "Parse SOAP 1.1/1.2 faults into code, reason, actor/node, role, and detail.",
  category: "web",
  tags: ["soap","fault","xml","debug"],
  keywords: ["soap","fault","xml","debug"],
  icon: "FileX",
  relatedTools: [],
};

export default meta;
