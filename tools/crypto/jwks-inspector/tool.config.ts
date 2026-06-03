import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "crypto-jwks-inspector-v1",
  name: "JWKS Inspector",
  slug: "jwks-inspector",
  description: "Inspect JSON Web Key Sets, key IDs, algorithms, use, key type, and rotation readiness.",
  category: "crypto",
  tags: ["jwks","jwk","jwt","keys"],
  keywords: ["jwks","jwk","jwt","keys"],
  icon: "KeyRound",
  relatedTools: [],
};

export default meta;
