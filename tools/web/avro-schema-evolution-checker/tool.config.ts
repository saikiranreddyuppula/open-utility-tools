import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-avro-schema-evolution-checker-v1",
  name: "Avro Schema Evolution Checker",
  slug: "avro-schema-evolution-checker",
  description: "Compare Avro record schemas for added, removed, changed, and default-less fields.",
  category: "web",
  tags: ["avro","schema","compatibility","diff"],
  keywords: ["avro","schema","compatibility","diff"],
  icon: "GitCompare",
  relatedTools: [],
};

export default meta;
