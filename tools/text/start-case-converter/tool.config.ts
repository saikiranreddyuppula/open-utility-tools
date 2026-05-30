import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'text-start-case-converter-v1',
  name: 'Start Case Converter',
  slug: 'start-case-converter',
  description:
    'Capitalize the first letter of every word while leaving the rest untouched, with optional separator normalization.',
  category: 'text',
  tags: ['text', 'case', 'capitalize', 'convert'],
  keywords: [
    'start case',
    'capitalize',
    'capitalise',
    'first letter',
    'word case',
    'uppercase first',
  ],
  icon: 'Heading',
  relatedTools: [],
};

export default meta;
