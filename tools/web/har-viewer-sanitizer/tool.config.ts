import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-har-viewer-sanitizer-v1',
  name: 'HAR Viewer & Sanitizer',
  slug: 'har-viewer-sanitizer',
  description:
    'Open a HAR file to browse requests with a waterfall, spot slow, large or failing calls, then redact cookies, tokens, keys and PII before you share it.',
  category: 'web',
  tags: ['har', 'network', 'waterfall', 'sanitize', 'redact', 'performance'],
  keywords: [
    'http archive',
    'har viewer',
    'har analyzer',
    'har sanitizer',
    'remove cookies from har',
    'redact har',
    'devtools network export',
    'waterfall chart',
    'request timing',
    'third party requests',
    'har file',
    'redirect chain',
    'uncompressed responses',
  ],
  icon: 'Activity',
  relatedTools: ['convert-har-to-curl', 'cookie-parser', 'jwt-decoder', 'web-http-message-parser'],
};

export default meta;
