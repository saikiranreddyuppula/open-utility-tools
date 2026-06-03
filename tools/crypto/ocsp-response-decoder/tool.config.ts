import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "crypto-ocsp-response-decoder-v1",
  name: "OCSP Response Decoder",
  slug: "ocsp-response-decoder",
  description: "Decode Base64 or PEM OCSP response bytes and summarize visible ASN.1/status hints.",
  category: "crypto",
  tags: ["ocsp","certificate","tls","decode"],
  keywords: ["ocsp","certificate","tls","decode"],
  icon: "FileSearch",
  relatedTools: [],
};

export default meta;
