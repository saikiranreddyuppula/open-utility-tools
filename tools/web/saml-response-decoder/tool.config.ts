import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-saml-response-decoder-v1",
  name: "SAML Response Decoder",
  slug: "saml-response-decoder",
  description: "Decode a SAMLResponse payload and extract assertion, issuer, audience, and subject details.",
  category: "web",
  tags: ["saml","sso","response","assertion"],
  keywords: ["samlresponse","assertion","base64","xml"],
  icon: "ShieldCheck",
  relatedTools: [],
};

export default meta;
