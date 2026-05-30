import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-at-mention-extractor-v1',
  name: 'Mention, Hashtag & URL Extractor',
  slug: 'at-mention-extractor',
  description:
    'Extract @mentions, #hashtags, $cashtags, and URLs from social text into clean deduplicated lists.',
  category: 'text',
  tags: ['mentions', 'hashtags', 'cashtags', 'urls', 'social'],
  keywords: ['extract mentions', 'extract hashtags', 'twitter handles', 'cashtag', 'url extractor', 'social media'],
  icon: 'AtSign',
  relatedTools: [],
};

export default meta;
