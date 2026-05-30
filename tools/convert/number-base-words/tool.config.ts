import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'convert-number-base-words-v1',
  name: 'Number to Spoken Base Words',
  slug: 'number-base-words',
  description:
    'Spell out a number in any base (2-36) as place-value words, e.g. binary 1011 as one-zero-one-one or grouped nibbles.',
  category: 'convert',
  tags: ['number', 'base', 'words', 'convert', 'radix'],
  keywords: ['base', 'radix', 'binary', 'hex', 'octal', 'digits', 'spoken', 'words', 'convert'],
  icon: 'Binary',
  relatedTools: [],
};

export default meta;
