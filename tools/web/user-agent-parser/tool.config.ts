import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-user-agent-v1',
  name: 'User-Agent Parser',
  slug: 'user-agent-parser',
  description: 'Parse a User-Agent string into browser, engine, OS and device.',
  category: 'web',
  tags: ['user agent', 'ua', 'browser', 'parse'],
  keywords: ['user agent', 'ua parser', 'browser detect', 'os detect', 'device'],
  icon: 'ScanLine',
  relatedTools: ['url-parser', 'http-status-codes', 'mime-types'],
};

export default meta;
