import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-sentence-case-converter-v1',
  name: 'Sentence Case Converter',
  slug: 'sentence-case-converter',
  description:
    'Lowercase text then capitalize the first letter of each sentence, preserving common acronyms and the pronoun I.',
  category: 'text',
  tags: ['case', 'sentence', 'capitalize', 'text', 'format'],
  keywords: [
    'sentence case',
    'capitalize sentences',
    'first letter',
    'lowercase',
    'acronym',
    'pronoun i',
  ],
  icon: 'Pilcrow',
  relatedTools: [],
};

export default meta;
