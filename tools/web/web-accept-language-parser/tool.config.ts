import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-accept-language-parser-v1',
  name: 'Accept-Language / Accept Parser',
  slug: 'web-accept-language-parser',
  description: 'Parse and sort Accept-Language or Accept headers by quality value (q-factor).',
  category: 'web',
  tags: ['accept-language', 'http header', 'q-factor', 'content negotiation', 'parser'],
  keywords: ['Accept header', 'Accept-Language', 'quality value', 'q-factor', 'language preference', 'content negotiation'],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
