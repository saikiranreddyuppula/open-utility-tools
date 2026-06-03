import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "crypto-csr-generator-validator-v1",
  name: "CSR Generator & Validator",
  slug: "csr-generator-validator",
  description: "Generate an OpenSSL CSR command and inspect pasted CSR PEM blocks.",
  category: "crypto",
  tags: ["csr","certificate","openssl","tls"],
  keywords: ["csr","certificate","openssl","tls"],
  icon: "FileKey",
  relatedTools: [],
};

export default meta;
