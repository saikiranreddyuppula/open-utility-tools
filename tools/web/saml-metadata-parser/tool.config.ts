import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-saml-metadata-parser-v1",
  name: "SAML Metadata Parser",
  slug: "saml-metadata-parser",
  description: "Parse SAML entity metadata and list endpoints, certs, bindings, and entity IDs.",
  category: "web",
  tags: ["saml","metadata","xml","sso"],
  keywords: ["saml","metadata","xml","sso"],
  icon: "FileSearch",
  relatedTools: [],
};

export default meta;
