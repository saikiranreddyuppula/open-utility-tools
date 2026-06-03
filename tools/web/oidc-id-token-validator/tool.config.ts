import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-oidc-id-token-validator-v1",
  name: "OIDC ID Token Validator",
  slug: "oidc-id-token-validator",
  description: "Decode an ID token and check issuer, audience, nonce, expiry, and clock claims.",
  category: "web",
  tags: ["oidc","jwt","token","auth"],
  keywords: ["oidc","jwt","token","auth"],
  icon: "ShieldCheck",
  relatedTools: [],
};

export default meta;
