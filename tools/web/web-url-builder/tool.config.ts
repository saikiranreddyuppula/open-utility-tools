import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'web-web-url-builder-v1',
  name: 'URL Builder',
  slug: 'web-url-builder',
  description:
    'Assemble a valid URL from individual scheme, host, port, path, query, and fragment fields.',
  category: 'web',
  tags: ['url', 'query', 'builder', 'encode', 'whatwg'],
  keywords: [
    'url builder',
    'query string',
    'percent encoding',
    'scheme',
    'host',
    'fragment',
    'whatwg url',
    'encodeuricomponent',
  ],
  icon: 'Link',
  relatedTools: [],
};

export default meta;
