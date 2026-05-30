import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-email-alias-generator-v1',
  name: 'Email Alias Generator',
  slug: 'email-alias-generator',
  description:
    'Generate plus-addressing and dot-trick Gmail aliases plus catch-all variants from one base email.',
  category: 'generators',
  tags: ['email', 'alias', 'gmail', 'plus-addressing', 'privacy'],
  keywords: [
    'email alias',
    'plus addressing',
    'gmail dot trick',
    'subaddressing',
    'catch-all',
    'tag',
    'throwaway',
    'mailbox',
  ],
  icon: 'AtSign',
  relatedTools: [],
};

export default meta;
