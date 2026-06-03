import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "web-webhook-retry-schedule-calculator-v1",
  name: "Webhook Retry Schedule Calculator",
  slug: "webhook-retry-schedule-calculator",
  description: "Model webhook retry attempts using delay, multiplier, jitter, and max delay.",
  category: "web",
  tags: ["webhook","retry","backoff","schedule"],
  keywords: ["webhook","retry","backoff","schedule"],
  icon: "Timer",
  relatedTools: [],
};

export default meta;
