import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-saml-request-decoder-v1",
  name: "SAML Request Decoder",
  slug: "saml-request-decoder",
  description: "Decode a SAMLRequest from URL, query string, or form input and inspect the XML.",
  category: "web",
  tags: ["saml","sso","decode","xml"],
  keywords: ["samlrequest","redirect binding","base64","deflate"],
  icon: "ShieldCheck",
  relatedTools: [],
};

export default meta;
