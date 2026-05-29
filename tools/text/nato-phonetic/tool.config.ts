import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-nato-phonetic-v1',
  name: 'NATO Phonetic Alphabet',
  slug: 'nato-phonetic',
  description: 'Spell text using the NATO phonetic alphabet (Alpha, Bravo, Charlie…).',
  category: 'text',
  tags: ['nato', 'phonetic', 'alphabet', 'spell'],
  keywords: ['nato phonetic', 'alpha bravo charlie', 'spelling alphabet', 'radio'],
  icon: 'Languages',
  relatedTools: ['morse-code', 'case-converter', 'rot13'],
};

export default meta;
