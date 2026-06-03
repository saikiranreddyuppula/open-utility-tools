import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-http-request-replay-sanitizer-v1",
  name: "HTTP Request Replay Sanitizer",
  slug: "http-request-replay-sanitizer",
  description: "Redact secrets from captured HTTP requests and emit a safer replay snippet.",
  category: "web",
  tags: ["http","request","redact","debug"],
  keywords: ["http","request","redact","debug"],
  icon: "Eraser",
  relatedTools: [],
};

export default meta;
