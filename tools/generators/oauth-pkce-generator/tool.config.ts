import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "generators-oauth-pkce-generator-v1",
  name: "OAuth PKCE Generator",
  slug: "oauth-pkce-generator",
  description: "Generate a PKCE verifier and S256 code challenge for OAuth authorization code flows.",
  category: "generators",
  tags: ["oauth","pkce","security","generator"],
  keywords: ["oauth","pkce","security","generator"],
  icon: "KeyRound",
  relatedTools: [],
};

export default meta;
