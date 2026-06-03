import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-kafka-message-header-viewer-v1",
  name: "Kafka Message Header Viewer",
  slug: "kafka-message-header-viewer",
  description: "Parse Kafka header key/value pairs and payload metadata for debugging consumers.",
  category: "web",
  tags: ["kafka","headers","events","debug"],
  keywords: ["kafka","headers","events","debug"],
  icon: "Database",
  relatedTools: [],
};

export default meta;
