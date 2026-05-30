import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-braille-text-v1',
  name: 'Braille (Grade 1) Translator',
  slug: 'braille-text',
  description: 'Convert text to and from Unicode Braille dot patterns using the Grade 1 (uncontracted) mapping.',
  category: 'text',
  tags: ['braille', 'unicode', 'accessibility', 'translate', 'encode'],
  keywords: ['braille translator', 'grade 1 braille', 'unicode braille', 'dot patterns', 'text to braille'],
  icon: 'Grid2x2',
  relatedTools: [],
};

export default meta;
