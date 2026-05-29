import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-extract-data-v1',
  name: 'Extract Emails, URLs & Numbers',
  slug: 'extract-data',
  description:
    'Pull all email addresses, URLs, phone numbers, IPs, or numbers out of a blob of text into a clean deduplicated list.',
  category: 'text',
  tags: ['extract', 'emails', 'urls'],
  keywords: ['extract', 'emails', 'urls', 'scrape', 'phone numbers'],
  icon: 'Filter',
  relatedTools: [],
};

export default meta;
