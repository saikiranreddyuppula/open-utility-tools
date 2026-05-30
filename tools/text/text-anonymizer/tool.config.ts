import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-anonymizer-v1',
  name: 'PII Placeholder Anonymizer',
  slug: 'text-anonymizer',
  description:
    'Replace emails, phone numbers, and other PII patterns with placeholder tokens.',
  category: 'text',
  tags: ['text', 'privacy', 'pii', 'redact'],
  keywords: [
    'anonymize',
    'redact',
    'pii',
    'mask',
    'email',
    'phone',
    'ip address',
    'credit card',
    'privacy',
  ],
  icon: 'Eye',
  relatedTools: [],
};

export default meta;
