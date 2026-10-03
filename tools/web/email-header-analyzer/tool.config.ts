import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-email-header-analyzer-v1',
  name: 'Email Header Analyzer',
  slug: 'email-header-analyzer',
  description:
    'Paste raw email headers or drop a .eml to see the delivery path with delays, SPF/DKIM/DMARC/ARC results, red flags, MIME structure and attachments.',
  category: 'web',
  tags: ['email', 'headers', 'spf', 'dkim', 'dmarc', 'eml'],
  keywords: [
    'email header analyzer',
    'message header',
    'received headers',
    'trace email',
    'phishing check',
    'spam headers',
    'authentication-results',
    'arc',
    'rfc 2047',
    'mime parser',
    'eml viewer',
    'email forensics',
    'delivery delay',
    'spoofing',
  ],
  icon: 'Mail',
  relatedTools: ['dkim-record-decoder', 'spf-flattening-analyzer', 'dmarc-record-builder', 'bimi-record-checker'],
};

export default meta;
