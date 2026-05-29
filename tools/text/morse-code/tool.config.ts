import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-morse-code-v1',
  name: 'Morse Code Translator',
  slug: 'morse-code',
  description: 'Translate text to International Morse code and back.',
  category: 'text',
  tags: ['morse', 'code', 'translate', 'cipher'],
  keywords: ['morse code', 'translate', 'dots dashes', 'cipher'],
  icon: 'Waves',
  relatedTools: ['rot13', 'base64-text', 'case-converter'],
};

export default meta;
