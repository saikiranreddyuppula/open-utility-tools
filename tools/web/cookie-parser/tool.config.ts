import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-cookie-parser-v1',
  name: 'Cookie Parser',
  slug: 'cookie-parser',
  description: 'Parse a Cookie or Set-Cookie header into a readable table of attributes.',
  category: 'web',
  tags: ['cookie', 'header', 'parse', 'set-cookie'],
  keywords: ['cookie parser', 'set-cookie', 'http cookie', 'attributes', 'samesite'],
  icon: 'FileSearch',
  relatedTools: ['url-parser', 'jwt-decoder', 'http-status-codes'],
};

export default meta;
