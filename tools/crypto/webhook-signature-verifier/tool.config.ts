import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: "crypto-webhook-signature-verifier-v1",
  name: "Webhook Signature Verifier",
  slug: "webhook-signature-verifier",
  description: "Verify HMAC webhook signatures used by GitHub, Slack, Stripe-style integrations.",
  category: "crypto",
  tags: ["webhook","hmac","signature","security"],
  keywords: ["webhook","hmac","signature","security"],
  icon: "Webhook",
  relatedTools: [],
};

export default meta;
