import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-text-redundancy-finder-v1',
  name: 'Repeated Phrase Finder',
  slug: 'text-redundancy-finder',
  description: 'Find phrases repeated multiple times in text to catch wordiness and filler.',
  category: 'text',
  tags: ['phrases', 'repetition', 'editing', 'analysis', 'wordiness'],
  keywords: ['repeated phrases', 'redundancy', 'filler', 'duplicate', 'n-gram', 'editing', 'cliche'],
  icon: 'Repeat',
  relatedTools: [],
};

export default meta;
