import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-pig-latin-v1',
  name: 'Pig Latin Translator',
  slug: 'pig-latin',
  description:
    'Translate English text to or from Pig Latin, moving leading consonants and appending the classic -ay ending.',
  category: 'text',
  tags: ['text', 'fun', 'translate'],
  keywords: ['pig latin', 'translate', 'fun', 'language game', 'encode'],
  icon: 'Languages',
  relatedTools: [],
};

export default meta;
