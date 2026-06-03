import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "crypto-certificate-decoder-x509-v1",
  name: "X.509 Certificate Decoder",
  slug: "certificate-decoder-x509",
  description: "Decode PEM certificate structure and extract subject, issuer, validity, SAN hints, and fingerprints when visible.",
  category: "crypto",
  tags: ["certificate","x509","tls","pem"],
  keywords: ["certificate","x509","tls","pem"],
  icon: "FileBadge",
  relatedTools: [],
};

export default meta;
