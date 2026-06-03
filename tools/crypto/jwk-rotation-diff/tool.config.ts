import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "crypto-jwk-rotation-diff-v1",
  name: "JWK Rotation Diff",
  slug: "jwk-rotation-diff",
  description: "Compare old and new JWKS documents and identify added, removed, and changed keys.",
  category: "crypto",
  tags: ["jwks","jwk","rotation","diff"],
  keywords: ["jwks","jwk","rotation","diff"],
  icon: "GitCompare",
  relatedTools: [],
};

export default meta;
