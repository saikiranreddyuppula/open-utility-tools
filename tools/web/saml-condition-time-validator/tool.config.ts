import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-saml-condition-time-validator-v1",
  name: "SAML Condition Time Validator",
  slug: "saml-condition-time-validator",
  description: "Validate NotBefore and NotOnOrAfter timestamps with configurable clock skew.",
  category: "web",
  tags: ["saml","time","condition","sso"],
  keywords: ["saml","time","condition","sso"],
  icon: "Clock",
  relatedTools: [],
};

export default meta;
